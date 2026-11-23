import React, { useState, useEffect, useMemo } from 'react';
import {
  FileStack,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  FileEdit,
  XCircle,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  Database,
  Cloud,
  Globe,
  Wallet,
  Files,
  BadgeCheck,
  Hourglass,
  Menu,
  Download,
  RefreshCw
} from 'lucide-react';
import { QuotationService, isSupabaseConfigured } from './lib/supabaseClient';

const STATUS_CONFIG = {
  'อนุมัติแล้ว': {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500'
  },
  'รออนุมัติ': {
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500'
  },
  'ฉบับร่าง': {
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500'
  },
  'ยกเลิก': {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500'
  }
};

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const [formData, setFormData] = useState({
    doc_number: '',
    doc_date: '',
    valid_until: '',
    customer_name: '',
    project_title: '',
    amount: '',
    status: 'รออนุมัติ',
    sales_owner: '',
    source_channel: 'React Web',
    notes: ''
  });

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3200);
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await QuotationService.fetchAll();
      setDocuments(data);
    } catch (err) {
      console.error(err);
      triggerToast('เกิดข้อผิดพลาดในการโหลดข้อมูลจาก Supabase');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const generateNextDocNumber = () => {
    const year = new Date().getFullYear();
    const prefix = `QT-${year}-`;
    let maxNum = 0;
    documents.forEach((doc) => {
      if (doc.doc_number && doc.doc_number.startsWith(prefix)) {
        const num = parseInt(doc.doc_number.replace(prefix, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  };

  const openCreateModal = () => {
    setEditingDoc(null);
    setFormData({
      doc_number: generateNextDocNumber(),
      doc_date: new Date().toISOString().split('T')[0],
      valid_until: '',
      customer_name: '',
      project_title: '',
      amount: '',
      status: 'รออนุมัติ',
      sales_owner: '',
      source_channel: 'React Web',
      notes: ''
    });
    setIsFormOpen(true);
  };

  const openEditModal = (doc) => {
    setEditingDoc(doc);
    setFormData({
      doc_number: doc.doc_number || '',
      doc_date: doc.doc_date || '',
      valid_until: doc.valid_until || '',
      customer_name: doc.customer_name || '',
      project_title: doc.project_title || '',
      amount: doc.amount ?? '',
      status: doc.status || 'รออนุมัติ',
      sales_owner: doc.sales_owner || '',
      source_channel: doc.source_channel || 'React Web',
      notes: doc.notes || ''
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        valid_until: formData.valid_until || null
      };

      if (editingDoc) {
        await QuotationService.update(editingDoc.id, payload);
        triggerToast(`อัปเดตเอกสาร ${payload.doc_number} เรียบร้อยแล้ว`);
      } else {
        await QuotationService.create(payload);
        triggerToast(`บันทึกใบเสนอราคา ${payload.doc_number} ลงฐานข้อมูลแล้ว`);
      }
      setIsFormOpen(false);
      await loadDocuments();
    } catch (err) {
      console.error(err);
      triggerToast('ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ Supabase');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`ยืนยันการลบใบเสนอราคา ${doc.doc_number} (${doc.customer_name}) ใช่หรือไม่?`)) {
      return;
    }
    try {
      await QuotationService.remove(doc.id);
      triggerToast(`ลบเอกสาร ${doc.doc_number} เรียบร้อยแล้ว`);
      await loadDocuments();
    } catch (err) {
      console.error(err);
      triggerToast('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const handleSimulateWixWebhook = async () => {
    setSaving(true);
    try {
      const nextNo = generateNextDocNumber();
      await QuotationService.create({
        doc_number: nextNo,
        doc_date: new Date().toISOString().split('T')[0],
        valid_until: null,
        customer_name: 'ลูกค้าจากหน้าเว็บ Wix (Wix Form Lead)',
        project_title: 'ขอใบเสนอราคาแพ็กเกจระบบจัดการเอกสารองค์กร',
        amount: 125000,
        status: 'รออนุมัติ',
        sales_owner: 'Wix Auto-Assign',
        source_channel: 'Wix Portal',
        notes: 'ส่งข้อมูลอัตโนมัติผ่าน Wix Velo Backend ➔ Supabase ➔ AWS PostgreSQL'
      });
      triggerToast(`รับข้อมูลใหม่ ${nextNo} จาก Wix Portal สำเร็จ!`);
      await loadDocuments();
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['เลขที่เอกสาร', 'ลูกค้า', 'หัวข้องาน', 'วันที่ออก', 'มูลค่าสุทธิ', 'สถานะ', 'ช่องทางที่มา'];
    const rows = filteredDocs.map((d) => [
      d.doc_number,
      `"${(d.customer_name || '').replace(/"/g, '""')}"`,
      `"${(d.project_title || '').replace(/"/g, '""')}"`,
      d.doc_date,
      d.amount,
      d.status,
      d.source_channel || 'React Web'
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quotations-aws-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('ส่งออกรายงาน CSV เรียบร้อยแล้ว');
  };

  const metrics = useMemo(() => {
    const totalCount = documents.length;
    const totalAmount = documents.reduce((s, d) => s + Number(d.amount || 0), 0);
    const approved = documents.filter((d) => d.status === 'อนุมัติแล้ว');
    const pending = documents.filter((d) => d.status === 'รออนุมัติ');
    const draft = documents.filter((d) => d.status === 'ฉบับร่าง');
    const cancelled = documents.filter((d) => d.status === 'ยกเลิก');

    return {
      totalCount,
      totalAmount,
      approvedCount: approved.length,
      approvedAmount: approved.reduce((s, d) => s + Number(d.amount || 0), 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, d) => s + Number(d.amount || 0), 0),
      draftCount: draft.length,
      cancelledCount: cancelled.length
    };
  }, [documents]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents
      .filter((doc) => {
        const matchStatus = statusFilter === 'ALL' || doc.status === statusFilter;
        const matchQuery =
          !q ||
          (doc.doc_number || '').toLowerCase().includes(q) ||
          (doc.customer_name || '').toLowerCase().includes(q) ||
          (doc.project_title || '').toLowerCase().includes(q) ||
          (doc.source_channel || '').toLowerCase().includes(q);
        return matchStatus && matchQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.doc_date) - new Date(a.doc_date);
        if (sortBy === 'date-asc') return new Date(a.doc_date) - new Date(b.doc_date);
        if (sortBy === 'amount-desc') return Number(b.amount) - Number(a.amount);
        if (sortBy === 'amount-asc') return Number(a.amount) - Number(b.amount);
        return 0;
      });
  }, [documents, statusFilter, searchQuery, sortBy]);

  const formatCurrency = (val) =>
    '฿' +
    Number(val || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const formatThaiDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-800">
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-navy-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out shadow-xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brandOrange-500 to-brandOrange-600 flex items-center justify-center shadow-lg shadow-brandOrange-500/30">
              <FileStack className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg leading-tight text-white">
                ระบบรวบรวมเอกสาร
              </h1>
              <p className="text-xs text-slate-400">Quotation Management</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            หมวดหมู่เอกสาร
          </p>

          {[
            { key: 'ALL', label: 'เอกสารทั้งหมด', icon: LayoutDashboard, count: metrics.totalCount, color: 'text-white' },
            { key: 'อนุมัติแล้ว', label: 'อนุมัติแล้ว', icon: CheckCircle2, count: metrics.approvedCount, color: 'text-emerald-400' },
            { key: 'รออนุมัติ', label: 'รออนุมัติ / ส่งแล้ว', icon: Clock, count: metrics.pendingCount, color: 'text-amber-400' },
            { key: 'ฉบับร่าง', label: 'ฉบับร่าง (Draft)', icon: FileEdit, count: metrics.draftCount, color: 'text-sky-400' },
            { key: 'ยกเลิก', label: 'ไม่อนุมัติ / ยกเลิก', icon: XCircle, count: metrics.cancelledCount, color: 'text-rose-400' }
          ].map((item) => {
            const Icon = item.icon;
            const active = statusFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setStatusFilter(item.key);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-brandOrange-500/25 to-brandOrange-500/5 text-white border-l-4 border-brandOrange-500'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                  {item.label}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    active ? 'bg-brandOrange-500 text-white' : 'bg-white/10 text-slate-200'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="bg-navy-800 rounded-xl p-3.5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-heading font-semibold text-brandOrange-400 flex items-center gap-1.5">
                <Cloud className="w-4 h-4" /> AWS Cloud Stack
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSupabaseConfigured
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {isSupabaseConfigured ? 'Supabase Live' : 'Demo Local'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              React + Wix ➔ Supabase API ➔ PostgreSQL (AWS Cloud)
            </p>
            <button
              onClick={handleSimulateWixWebhook}
              disabled={saving}
              className="w-full mt-1 py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-brandOrange-400" />
              จำลองส่งข้อมูลจาก Wix
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-navy-800 hover:bg-slate-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="font-heading font-bold text-xl sm:text-2xl text-navy-900">
                ระบบรวบรวมเอกสาร
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">
                จัดการใบเสนอราคาจาก React และ Wix ผ่าน Supabase สู่ PostgreSQL บน AWS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCsv}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-heading text-sm font-medium"
            >
              <Download className="w-4 h-4 text-navy-600" />
              ส่งออก CSV
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-brandOrange-500 hover:bg-brandOrange-600 text-white font-heading text-sm font-semibold shadow-md shadow-brandOrange-500/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มใบเสนอราคา</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* KPI CARDS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">ใบเสนอราคาทั้งหมด</p>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold text-navy-900 mt-1">
                  {metrics.totalCount} ฉบับ
                </h3>
                <p className="text-xs text-slate-400 mt-1.5">รวมข้อมูลจาก React & Wix</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
                <Files className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-navy-800 to-navy-900 rounded-2xl p-5 text-white shadow-md flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">มูลค่ารวมทั้งหมด</p>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold text-white mt-1">
                  {formatCurrency(metrics.totalAmount)}
                </h3>
                <p className="text-xs text-brandOrange-400 mt-1.5 font-medium">
                  ฐานข้อมูล PostgreSQL (AWS)
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-brandOrange-500 text-white flex items-center justify-center shadow-lg shadow-brandOrange-500/30">
                <Wallet className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">ยอดที่อนุมัติแล้ว</p>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(metrics.approvedAmount)}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5">
                  {metrics.approvedCount} รายการที่ปิดการขาย
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <BadgeCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">รอดำเนินการ / รออนุมัติ</p>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold text-brandOrange-600 mt-1">
                  {formatCurrency(metrics.pendingAmount)}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5">
                  {metrics.pendingCount} รายการที่กำลังติดตาม
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-brandOrange-50 text-brandOrange-600 flex items-center justify-center">
                <Hourglass className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* SEARCH & FILTER */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
            <div className="flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาเลขที่ใบเสนอราคา (QT-2026), ชื่อลูกค้า, หัวข้องาน หรือช่องทาง..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brandOrange-500"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-2.5">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brandOrange-500"
                >
                  <option value="ALL">สถานะ: ทั้งหมด</option>
                  <option value="อนุมัติแล้ว">อนุมัติแล้ว</option>
                  <option value="รออนุมัติ">รออนุมัติ</option>
                  <option value="ฉบับร่าง">ฉบับร่าง</option>
                  <option value="ยกเลิก">ยกเลิก</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brandOrange-500"
                >
                  <option value="date-desc">เรียงตาม: วันที่ล่าสุด</option>
                  <option value="date-asc">เรียงตาม: วันที่เก่าสุด</option>
                  <option value="amount-desc">เรียงตาม: มูลค่าสูงสุด</option>
                  <option value="amount-asc">เรียงตาม: มูลค่าต่ำสุด</option>
                </select>

                <button
                  onClick={loadDocuments}
                  title="รีเฟรชข้อมูลจากฐานข้อมูล"
                  className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brandOrange-500' : ''}`} />
                </button>
              </div>
            </div>
          </section>

          {/* TABLE & MOBILE CARDS */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brandOrange-500" />
                <h3 className="font-heading font-semibold text-navy-900 text-base">
                  รายการเอกสารใบเสนอราคา
                </h3>
              </div>
              <span className="text-xs font-medium text-slate-500">
                แสดง {filteredDocs.length} จาก {documents.length} รายการ
              </span>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-navy-900 text-white text-xs font-heading uppercase tracking-wider">
                    <th className="py-3.5 px-5">เลขที่เอกสาร</th>
                    <th className="py-3.5 px-5">ชื่อลูกค้า / บริษัท</th>
                    <th className="py-3.5 px-5">หัวข้องาน</th>
                    <th className="py-3.5 px-5">ช่องทาง</th>
                    <th className="py-3.5 px-5">วันที่ออก</th>
                    <th className="py-3.5 px-5 text-right">มูลค่าสุทธิ</th>
                    <th className="py-3.5 px-5 text-center">สถานะ</th>
                    <th className="py-3.5 px-5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredDocs.map((doc) => {
                    const st = STATUS_CONFIG[doc.status] || STATUS_CONFIG['ฉบับร่าง'];
                    return (
                      <tr key={doc.id} className="hover:bg-orange-50/40 transition-colors">
                        <td className="py-4 px-5 font-heading font-semibold text-navy-800 whitespace-nowrap">
                          {doc.doc_number}
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-semibold text-slate-800">{doc.customer_name}</div>
                          <div className="text-xs text-slate-400">
                            ผู้ดูแล: {doc.sales_owner || '-'}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-slate-600 max-w-xs truncate" title={doc.project_title}>
                          {doc.project_title}
                        </td>
                        <td className="py-4 px-5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                              doc.source_channel === 'Wix Portal'
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {doc.source_channel || 'React Web'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-slate-600 whitespace-nowrap">
                          {formatThaiDate(doc.doc_date)}
                        </td>
                        <td className="py-4 px-5 text-right font-heading font-bold text-navy-900 whitespace-nowrap">
                          {formatCurrency(doc.amount)}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setViewingDoc(doc)}
                              title="ดูรายละเอียด"
                              className="p-2 rounded-lg text-slate-500 hover:text-navy-700 hover:bg-navy-50"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(doc)}
                              title="แก้ไขเอกสาร"
                              className="p-2 rounded-lg text-slate-500 hover:text-brandOrange-600 hover:bg-brandOrange-50"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc)}
                              title="ลบเอกสาร"
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-200">
              {filteredDocs.map((doc) => {
                const st = STATUS_CONFIG[doc.status] || STATUS_CONFIG['ฉบับร่าง'];
                return (
                  <div key={doc.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-heading font-bold text-brandOrange-600 bg-brandOrange-50 px-2.5 py-0.5 rounded-md">
                            {doc.doc_number}
                          </span>
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {doc.source_channel || 'React Web'}
                          </span>
                        </div>
                        <h4 className="font-semibold text-navy-900 text-base mt-1.5">
                          {doc.customer_name}
                        </h4>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${st.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {doc.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600">{doc.project_title}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <span>วันที่: {formatThaiDate(doc.doc_date)}</span>
                      <span className="font-heading font-bold text-base text-navy-900">
                        {formatCurrency(doc.amount)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-navy-50 text-navy-800 font-heading text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" /> รายละเอียด
                      </button>
                      <button
                        onClick={() => openEditModal(doc)}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brandOrange-50 text-brandOrange-700 font-heading text-xs font-semibold"
                      >
                        <Pencil className="w-3.5 h-3.5" /> แก้ไข
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-50 text-rose-700 font-heading text-xs font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> ลบ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredDocs.length === 0 && !loading && (
              <div className="py-14 px-4 text-center">
                <Database className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="font-heading font-semibold text-navy-900">ไม่พบข้อมูลเอกสาร</h4>
                <p className="text-sm text-slate-500 mt-1">
                  ลองเปลี่ยนเงื่อนไขการค้นหา หรือกดปุ่ม "เพิ่มใบเสนอราคา"
                </p>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* MODAL: ADD / EDIT FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-navy-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-heading font-semibold text-lg">
                {editingDoc
                  ? `แก้ไขใบเสนอราคา (${editingDoc.doc_number})`
                  : 'เพิ่มใบเสนอราคาใหม่'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    เลขที่ใบเสนอราคา *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.doc_number}
                    onChange={(e) => setFormData({ ...formData, doc_number: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-slate-50 font-semibold text-navy-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    วันที่ออกเอกสาร *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.doc_date}
                    onChange={(e) => setFormData({ ...formData, doc_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                  ชื่อลูกค้า / บริษัท *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น บริษัท สยามเทค โซลูชั่น จำกัด"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                  หัวข้องาน / โครงการ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น พัฒนาระบบฐานข้อมูลบนคลาวด์ AWS"
                  value={formData.project_title}
                  onChange={(e) => setFormData({ ...formData, project_title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    มูลค่ารวมสุทธิ (บาท) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    สถานะเอกสาร *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="ฉบับร่าง">ฉบับร่าง</option>
                    <option value="รออนุมัติ">รออนุมัติ</option>
                    <option value="อนุมัติแล้ว">อนุมัติแล้ว</option>
                    <option value="ยกเลิก">ยกเลิก</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    ช่องทางหน้าบ้าน
                  </label>
                  <select
                    value={formData.source_channel}
                    onChange={(e) => setFormData({ ...formData, source_channel: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="React Web">React Web</option>
                    <option value="Wix Portal">Wix Portal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    ผู้รับผิดชอบ
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น คุณกิตติพงษ์"
                    value={formData.sales_owner}
                    onChange={(e) => setFormData({ ...formData, sales_owner: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    ยืนราคาถึงวันที่
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-heading text-sm font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-brandOrange-500 hover:bg-brandOrange-600 text-white font-heading text-sm font-semibold shadow-md"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลเอกสาร'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DETAILS */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-navy-900 to-navy-700 px-6 py-4 flex items-center justify-between text-white">
              <div>
                <span className="text-xs font-heading uppercase tracking-wider text-brandOrange-400 font-bold">
                  {viewingDoc.doc_number} • {viewingDoc.source_channel || 'React Web'}
                </span>
                <h3 className="font-heading font-semibold text-lg">รายละเอียดใบเสนอราคา</h3>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">ชื่อลูกค้า / บริษัท</p>
                <p className="font-semibold text-navy-900 text-base mt-0.5">
                  {viewingDoc.customer_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">หัวข้องาน / โครงการ</p>
                <p className="text-slate-700 mt-0.5">{viewingDoc.project_title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs text-slate-400">วันที่ออกเอกสาร</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {formatThaiDate(viewingDoc.doc_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">มูลค่าสุทธิ</p>
                  <p className="font-heading font-bold text-brandOrange-600 text-base mt-0.5">
                    {formatCurrency(viewingDoc.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">สถานะเอกสาร</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{viewingDoc.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">ผู้รับผิดชอบ</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {viewingDoc.sales_owner || '-'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400">หมายเหตุ</p>
                <p className="text-slate-600 bg-amber-50/50 border border-amber-100 rounded-xl p-3 mt-1 text-xs">
                  {viewingDoc.notes || 'ไม่มีหมายเหตุเพิ่มเติม'}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  const target = viewingDoc;
                  setViewingDoc(null);
                  openEditModal(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-900 text-white font-heading text-sm font-medium"
              >
                <Pencil className="w-4 h-4" /> แก้ไขเอกสารนี้
              </button>
              <button
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white font-heading text-sm font-medium"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-navy-900 text-white px-4 py-3 rounded-xl shadow-xl border-l-4 border-brandOrange-500 text-sm font-medium">
          {toastMessage}
        </div>
      )}
    </div>
  );
}