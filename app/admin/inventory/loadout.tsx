'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; // Adjust path

export default function LoadOutPage() {
    const [masterItems, setMasterItems] = useState([]);
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState('');

    useEffect(() => {
        const fetchInitial = async () => {
            const { data: items } = await supabase.from('inventory_master').select('*');
            const { data: evs } = await supabase.from('event_settings').select('slug, event_name');
            setMasterItems(items);
            setEvents(evs);
        };
        fetchInitial();
    }, []);

    const handleTransfer = async (item: any, qty: number) => {
        if (!selectedEvent) return alert("Select an event first!");
        
        // 1. Update Master Stock
        const { error: masterErr } = await supabase
            .from('inventory_master')
            .update({ quantity_on_hand: item.quantity_on_hand - qty })
            .eq('sku', item.sku);

        // 2. Add to Event Stock (inventory table)
        const { data: existing } = await supabase
            .from('inventory')
            .select('*')
            .eq('event_slug', selectedEvent)
            .eq('product_id', item.product_id)
            .eq('size', item.size)
            .single();

        if (existing) {
            await supabase.from('inventory').update({ count: existing.count + qty }).eq('id', existing.id);
        } else {
            await supabase.from('inventory').insert({
                event_slug: selectedEvent,
                product_id: item.product_id,
                size: item.size,
                count: qty,
                active: true
            });
        }
        alert("Transfer Complete!");
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Pack the Truck (Load Out)</h1>
            <select className="p-2 border rounded mb-4 w-full" onChange={(e) => setSelectedEvent(e.target.value)}>
                <option value="">-- Select Destination Event --</option>
                {events.map(ev => <option key={ev.slug} value={ev.slug}>{ev.event_name}</option>)}
            </select>

            <div className="grid gap-4">
                {masterItems.map(item => (
                    <div key={item.sku} className="flex justify-between items-center p-4 border rounded bg-white">
                        <span>{item.item_name} ({item.size}) - Stock: {item.quantity_on_hand}</span>
                        <div className="flex gap-2">
                            <input type="number" id={`qty-${item.sku}`} defaultValue={12} className="w-16 border p-1" />
                            <button 
                                onClick={() => handleTransfer(item, Number((document.getElementById(`qty-${item.sku}`) as HTMLInputElement).value))}
                                className="bg-blue-600 text-white px-4 py-1 rounded"
                            >
                                Transfer
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}