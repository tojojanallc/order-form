'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import Link from 'next/link';

export default function ReceivePO() {
  const [openPOs, setOpenPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpenPOs();
  }, []);

  const fetchOpenPOs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('purchases')
      .select('*, vendors(name)')
      .eq('status', 'ordered')
      .order('created_at', { ascending: false });
    setOpenPOs(data || []);
    setLoading(false);
  };

  const loadPO = async (po) => {
    setSelectedPO(po);
    const { data } = await supabase
      .from('purchase_items')
      .select('*, inventory_master(item_name, size)')
      .eq('purchase_id', po.id);
    setPoItems(data || []);
  };

  const receiveAll = async () => {
    if (!confirm(`Confirm receipt of PO ${selectedPO.po_number}?`)) return;

    try {
      for (const item of poItems) {
        const { data: current } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.sku).single();
        await supabase.from('inventory_master').update({
            quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
            cost_per_unit: item.unit_cost 
        }).eq('sku', item.sku);
      }
      await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);
      alert("✅ Stock Received!");
      setSelectedPO(null);
      fetchOpenPOs();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div style={{ backgroundColor: 'white', color: 'black', minHeight: '100vh', padding: '40px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '4px solid black', paddingBottom: '20px', marginBottom: '40px' }}>
          <div>
            <Link href="/admin" style={{ color: '#2563eb', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px', textDecoration: 'underline' }}>
              ← Back to Dashboard
            </Link>
            <h1 style={{ fontSize: '40px', fontWeight: '900', textTransform: 'uppercase', margin: '8px 0 0 0' }}>Receive Stock</h1>
          </div>
        </div>
        
        {!selectedPO ? (
          <div>
            {loading ? (
              <p style={{ fontWeight: 'bold' }}>Loading shipments...</p>
            ) : openPOs.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '60px', border: '2px dashed #ccc', borderRadius: '12px' }}>
                  <p style={{ color: '#666', fontWeight: 'bold' }}>No open purchase orders.</p>
                  <Link href="/admin/purchasing/create" style={{ display: 'inline-block', marginTop: '20px', backgroundColor: 'black', color: 'white', padding: '12px 24px', fontWeight: 'bold', textDecoration: 'none' }}>
                    Create New PO
                  </Link>
               </div>
            ) : (
              openPOs.map(po => (
                <div key={po.id} onClick={() => loadPO(po)} style={{ backgroundColor: 'white', padding: '24px', border: '2px solid black', marginBottom: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '4px 4px 0px 0px black' }}>
                   <div>
                     <div style={{ fontSize: '24px', fontWeight: '900' }}>{po.po_number}</div>
                     <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{po.vendors?.name}</div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: '900' }}>${po.total_amount?.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#fde047', padding: '4px 8px', textTransform: 'uppercase', marginTop: '8px', border: '1px solid black' }}>Ordered</div>
                   </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ border: '4px solid black', padding: '32px', boxShadow: '8px 8px 0px 0px black', backgroundColor: 'white' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '2px solid black', paddingBottom: '24px' }}>
                <div>
                    <button onClick={() => setSelectedPO(null)} style={{ color: '#2563eb', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>← Back to List</button>
                    <h2 style={{ fontSize: '40px', fontWeight: '900', margin: '4px 0' }}>{selectedPO.po_number}</h2>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>{selectedPO.vendors?.name}</p>
                </div>
                <button 
                    onClick={receiveAll} 
                    style={{ backgroundColor: '#16a34a', color: 'white', padding: '20px 40px', fontWeight: '900', textTransform: 'uppercase', fontSize: '18px', border: '2px solid black', boxShadow: '4px 4px 0px 0px black', cursor: 'pointer' }}
                >
                   Verify & Receive
                </button>
             </div>
             
             <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid black' }}>
                        <th style={{ padding: '16px', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px' }}>Item</th>
                        <th style={{ padding: '16px', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '16px', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px', textAlign: 'right' }}>Cost</th>
                    </tr>
                </thead>
                <tbody>
                   {poItems.map(item => (
                     <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '24px 16px', fontSize: '20px', fontWeight: '900' }}>
                            {item.inventory_master?.item_name} <span style={{ color: '#999', fontWeight: 'bold', marginLeft: '8px' }}>({item.inventory_master?.size})</span>
                        </td>
                        <td style={{ padding: '24px 16px', fontSize: '24px', fontWeight: '900', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '24px 16px', fontSize: '18px', fontWeight: 'bold', textAlign: 'right', color: '#666' }}>${item.unit_cost.toFixed(2)}</td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}
      </div>
    </div>
  );
}