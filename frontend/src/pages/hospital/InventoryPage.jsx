import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiPackage, FiPlus, FiRefreshCw } from 'react-icons/fi';
import DashboardLayout from '../../components/common/DashboardLayout';
import Modal from '../../components/common/Modal';
import API from '../../api/axios';
import useApi from '../../hooks/useApi';

// ─── Equipment categories (hospital inventory = equipment only, no medicines) ──
const EQUIPMENT_EMOJI = {
  medical_equipment: '🏥',
  diagnostic: '🔬',
  surgical: '⚕️',
  monitoring: '📊',
  emergency: '🚨',
  laboratory: '🧪',
  imaging: '📷',
  therapy: '💊',
  furniture: '🛏️',
  other: '📦',
};

const CATEGORY_OPTIONS = [
  { value: 'medical_equipment', label: 'Medical Equipment' },
  { value: 'diagnostic', label: 'Diagnostic Equipment' },
  { value: 'surgical', label: 'Surgical Equipment' },
  { value: 'monitoring', label: 'Monitoring Equipment' },
  { value: 'emergency', label: 'Emergency Equipment' },
  { value: 'laboratory', label: 'Laboratory Equipment' },
  { value: 'imaging', label: 'Imaging Equipment' },
  { value: 'therapy', label: 'Therapy Equipment' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_LABEL = (cat) => cat.replace(/_/g, ' ');

const BLANK_FORM = {
  item_name: '',
  category: 'medical_equipment',
  quantity: '',
  unit: '',
  reorder_level: '10',
};

// ─── Equipment Card ─────────────────────────────────────────────────────────
const EquipmentCard = ({ item, onEdit, onDelete, onImageUpload }) => (
  <div
    className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200"
    style={{ cursor: 'pointer' }}
  >
    {/* Image / emoji */}
    <div className="relative h-40" style={{ backgroundColor: '#FFF7ED' }}>
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.item_name}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-6xl">
          {EQUIPMENT_EMOJI[item.category] || '📦'}
        </div>
      )}

      {/* Stock status badge */}
      <div className="absolute top-2 right-2">
        {item.quantity === 0 ? (
          <span className="bg-black text-white text-xs px-2 py-1 rounded-full font-medium">Out of Stock</span>
        ) : item.quantity <= item.reorder_level ? (
          <span className="text-white text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F97316' }}>
            Low Stock
          </span>
        ) : (
          <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full font-medium">In Stock</span>
        )}
      </div>

      {/* Upload image button */}
      <label className="absolute bottom-2 right-2 cursor-pointer">
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md text-sm">📷</div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onImageUpload(item.inventory_id, e.target.files[0])}
        />
      </label>
    </div>

    {/* Body */}
    <div className="p-4">
      <h3 className="font-bold text-base text-black mb-1 line-clamp-1">{item.item_name}</h3>

      <span
        className="text-xs px-2 py-1 rounded-full font-medium capitalize mb-3 inline-block"
        style={{ backgroundColor: '#FFF7ED', color: '#F97316' }}
      >
        {CATEGORY_LABEL(item.category)}
      </span>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-xl p-2 text-center">
          <p className="text-xs text-gray-500">Quantity</p>
          <p className="font-bold text-lg text-black">{item.quantity}</p>
          <p className="text-xs text-gray-400">{item.unit}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2 text-center">
          <p className="text-xs text-gray-500">Reorder at</p>
          <p className="font-bold text-lg text-black">{item.reorder_level}</p>
          <p className="text-xs text-gray-400">units</p>
        </div>
      </div>

      {item.maintenance_due && (
        <p className="text-xs text-gray-500 mb-3">🔧 Maintenance: {item.maintenance_due}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onEdit(item)}
          className="flex-1 py-2 rounded-full text-sm font-medium text-white transition-all"
          style={{ backgroundColor: '#F97316' }}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex-1 py-2 rounded-full text-sm font-medium bg-black text-white transition-all"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

const InventoryPage = () => {
  const inventory = useApi('/api/hospital/inventory/');
  const [form, setForm]       = useState(BLANK_FORM);
  const [adding, setAdding]   = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving]   = useState(false);

  const items = inventory.data?.items || (Array.isArray(inventory.data) ? inventory.data : []);
  const lowStockCount = inventory.data?.low_stock_count ?? items.filter((i) => i.is_low_stock).length;

  const refetchInventory = () => inventory.refetch();

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim()) { toast.error('Item name is required'); return; }
    if (!form.quantity) { toast.error('Quantity is required'); return; }
    setAdding(true);
    try {
      await API.post('/api/hospital/inventory/add/', {
        item_name: form.item_name.trim(),
        category: form.category,
        quantity: parseInt(form.quantity, 10),
        unit: form.unit,
        reorder_level: parseInt(form.reorder_level || '10', 10),
      });
      toast.success('Equipment added to inventory');
      refetchInventory();
      setForm(BLANK_FORM);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleImageUpload = async (itemId, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await API.post(
        `/api/hospital/inventory/${itemId}/upload-image/`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      if (response.data.success) {
        toast.success('Image uploaded!');
        refetchInventory();
      }
    } catch {
      toast.error('Upload failed!');
    }
  };

  const handleEdit = (item) => setEditItem({ ...item });

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      await API.put(`/api/hospital/inventory/${editItem.inventory_id}/`, {
        item_name: editItem.item_name,
        category: editItem.category,
        quantity: parseInt(editItem.quantity, 10),
        reorder_level: parseInt(editItem.reorder_level, 10),
        unit: editItem.unit,
      });
      toast.success('Equipment updated');
      setEditItem(null);
      refetchInventory();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.item_name}" from inventory?`)) return;
    try {
      await API.delete(`/api/hospital/inventory/${item.inventory_id}/`);
      toast.success('Equipment deleted');
      refetchInventory();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black">Equipment Inventory</h1>
          <p className="text-sm text-gray-500">Track medical equipment, devices, and assets</p>
        </div>
        <button
          onClick={refetchInventory}
          className="inline-flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-orange-50 transition"
        >
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ─── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 text-center py-4">
          <div className="text-3xl font-bold text-black">{items.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Equipment</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 text-center py-4">
          <div className="text-3xl font-bold" style={{ color: lowStockCount > 0 ? '#F97316' : '#000' }}>{lowStockCount}</div>
          <div className="text-xs text-gray-500 mt-1">Low Stock Alerts</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 text-center py-4">
          <div className="text-3xl font-bold text-black">{items.filter((i) => i.quantity === 0).length}</div>
          <div className="text-xs text-gray-500 mt-1">Out of Stock</div>
        </div>
      </div>

      {/* ─── Add Item Form ────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-8">
        <h2 className="flex items-center gap-2 text-base font-bold text-black mb-4">
          <FiPlus className="w-4 h-4" /> Add Equipment
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Item Name *</label>
            <input
              placeholder="e.g. ECG Monitor"
              value={form.item_name}
              onChange={(e) => setForm((p) => ({ ...p, item_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
            <input
              type="number" min="0" placeholder="0"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
            <input
              placeholder="e.g. units, sets"
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
            <input
              type="number" min="0" placeholder="10"
              value={form.reorder_level}
              onChange={(e) => setForm((p) => ({ ...p, reorder_level: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={adding}
              className="w-full inline-flex items-center justify-center gap-2 text-white px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-60"
              style={{ backgroundColor: '#F97316' }}
            >
              <FiPlus className="w-4 h-4" />
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </section>

      {/* ─── Inventory Card Grid ──────────────────────────────── */}
      <section>
        <h2 className="text-base font-bold text-black mb-4 flex items-center gap-2">
          <FiPackage className="w-4 h-4" /> All Equipment
        </h2>
        {inventory.loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">Loading inventory…</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-gray-500 font-medium">No equipment in inventory yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <EquipmentCard
                key={item.inventory_id}
                item={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onImageUpload={handleImageUpload}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Edit Modal ───────────────────────────────────────── */}
      <Modal isOpen={Boolean(editItem)} onClose={() => setEditItem(null)} title="Edit Equipment">
        {editItem && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Item Name</label>
              <input
                value={editItem.item_name}
                onChange={(e) => setEditItem((p) => ({ ...p, item_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  value={editItem.category}
                  onChange={(e) => setEditItem((p) => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                <input
                  value={editItem.unit || ''}
                  onChange={(e) => setEditItem((p) => ({ ...p, unit: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                <input
                  type="number" min="0"
                  value={editItem.quantity}
                  onChange={(e) => setEditItem((p) => ({ ...p, quantity: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
                <input
                  type="number" min="0"
                  value={editItem.reorder_level}
                  onChange={(e) => setEditItem((p) => ({ ...p, reorder_level: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 py-3 rounded-full font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#F97316' }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditItem(null)}
                className="flex-1 py-3 rounded-full font-semibold bg-black text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default InventoryPage;
