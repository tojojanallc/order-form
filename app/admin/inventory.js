// pages/admin/inventory.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase'; // Adjust path to your supabase client

export default function InventoryAdmin() {
    const [masterInv, setMasterInv] = useState([]);
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState('');
    const [loadQty, setLoadQty] = useState(0);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: master } = await supabase.from('inventory_master').select('*');
        const { data: evs } = await supabase.from('event_settings').select('slug, event_name');
        setMasterInv(master);
        setEvents(evs);
    };

    // ACTION: "BUY" FOR EVENT (Load Truck)
    const handleLoadOut = async (item, qty) => {
        if (!selectedEvent) return alert("Select an event first");
        
        // 1. Remove from Master
        await supabase.from('inventory_master')
            .update({ quantity_on_hand: item.quantity_on_hand - qty })
            .eq('sku', item.sku);

        // 2. Add to Event Inventory (or update if exists)
        const { data: existing } = await supabase.from('inventory')
            .select('*').eq('event_slug', selectedEvent).eq('product_id', item.product_id).eq('size', item.size).single();

        if (existing) {
            await supabase.from('inventory').update({
                count: existing.count + qty,
                quantity_loaded: (existing.quantity_loaded || 0) + qty
            }).eq('id', existing.id);
        } else {
            await supabase.from('inventory').insert({
                event_slug: selectedEvent,
                product_id: item.product_id,
                size: item.size,
                count: qty,
                quantity_loaded: qty,
                active: true
            });
        }
        alert(`Loaded ${qty} units to ${selectedEvent}`);
        fetchData();
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Inventory Manager (Buy/Return)</h1>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <label className="block font-bold">Step 1: Select Active Event</label>
                <select className="w-full p-2 border" onChange={(e) => setSelectedEvent(e.target.value)}>
                    <option value="">-- Choose Event --</option>
                    {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
                </select>
            </div>

            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 border">Item</th>
                        <th className="p-2 border">In Warehouse</th>
                        <th className="p-2 border">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {masterInv.map(item => (
                        <tr key={item.sku}>
                            <td className="p-2 border font-medium">{item.item_name} ({item.size})</td>
                            <td className="p-2 border text-center">{item.quantity_on_hand}</td>
                            <td className="p-2 border">
                                <div className="flex gap-2">
                                    <input type="number" className="w-16 border p-1" defaultValue={12} id={`qty-${item.sku}`} />
                                    <button 
                                        onClick={() => handleLoadOut(item, parseInt(document.getElementById(`qty-${item.sku}`).value))}
                                        className="bg-blue-600 text-white px-2 py-1 rounded text-sm"
                                    >
                                        Load to Truck
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}