import React, { useState, useEffect, useMemo } from "react";
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
  RefreshCw,
  Printer,
  Upload,
  Building2,
  CreditCard,
} from "lucide-react";
import {
  supabase,
  QuotationService,
  isSupabaseConfigured,
} from "./lib/supabaseClient";

const STATUS_CONFIG = {
  อนุมัติแล้ว: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  รออนุมัติ: {
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  ฉบับร่าง: {
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
  },
  ยกเลิก: {
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
};

const DEFAULT_SELLER = {
  company_name: "บริษัท อินเตอร์สปีดี้ เทคโนโลยี จำกัด",
  address:
    "123/45 อาคารซอฟต์แวร์พาร์ค ถนนรัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310",
  tax_id: "0105566001234",
  logo_url: "",
};

const DEFAULT_ITEM = {
  code: "SRV-001",
  description: "",
  qty: 1,
  unit_price: 0,
};

// ตัวช่วยแพ็ก/แกะข้อมูลรายละเอียดใบเสนอราคาลงในคอลัมน์ notes เพื่อไม่ให้ติด Error โครงสร้างตารางเดิมใน Supabase
const META_TAG = "\n---QUOTATION_DETAIL_JSON---\n";

function serializeQuotationPayload(form) {
  const detailMeta = {
    ref_number: form.ref_number || "",
    seller_name: form.seller_name || DEFAULT_SELLER.company_name,
    seller_address: form.seller_address || DEFAULT_SELLER.address,
    seller_tax_id: form.seller_tax_id || DEFAULT_SELLER.tax_id,
    seller_logo: form.seller_logo || "",
    customer_address: form.customer_address || "",
    customer_tax_id: form.customer_tax_id || "",
    items: Array.isArray(form.items) ? form.items : [],
    include_vat: Boolean(form.include_vat),
    payment_info: form.payment_info || "",
    approver_name: form.approver_name || "",
    acceptor_name: form.acceptor_name || "",
  };

  const cleanNotes = (form.notes || "").trim();
  const combinedNotes = `${cleanNotes}${META_TAG}${JSON.stringify(detailMeta)}`;

  return {
    doc_number: form.doc_number,
    doc_date: form.doc_date,
    valid_until: form.valid_until || null,
    customer_name: form.customer_name,
    project_title: form.project_title,
    amount: Number(form.amount) || 0,
    status: form.status,
    sales_owner: form.sales_owner,
    source_channel: form.source_channel,
    notes: combinedNotes,
  };
}

function parseQuotationRecord(doc) {
  const rawNotes = doc.notes || "";
  const splitIdx = rawNotes.indexOf(META_TAG);

  let cleanNotes = rawNotes;
  let meta = {};

  if (splitIdx !== -1) {
    cleanNotes = rawNotes.slice(0, splitIdx).trim();
    const jsonPart = rawNotes.slice(splitIdx + META_TAG.length).trim();
    try {
      meta = JSON.parse(jsonPart);
    } catch {
      meta = {};
    }
  }

  const fallbackItems = [
    {
      code: "ITEM-001",
      description: doc.project_title || "รายการสินค้า/บริการตามใบเสนอราคา",
      qty: 1,
      unit_price: Number(doc.amount || 0),
    },
  ];

  return {
    ...doc,
    cleanNotes,
    ref_number: meta.ref_number || doc.ref_number || "-",
    seller_name:
      meta.seller_name || doc.seller_name || DEFAULT_SELLER.company_name,
    seller_address:
      meta.seller_address || doc.seller_address || DEFAULT_SELLER.address,
    seller_tax_id:
      meta.seller_tax_id || doc.seller_tax_id || DEFAULT_SELLER.tax_id,
    seller_logo: meta.seller_logo || doc.seller_logo || "",
    customer_address: meta.customer_address || doc.customer_address || "-",
    customer_tax_id: meta.customer_tax_id || doc.customer_tax_id || "-",
    items:
      Array.isArray(meta.items) && meta.items.length > 0
        ? meta.items
        : Array.isArray(doc.items) && doc.items.length > 0
          ? doc.items
          : fallbackItems,
    include_vat:
      meta.include_vat !== undefined
        ? Boolean(meta.include_vat)
        : Boolean(doc.include_vat),
    payment_info:
      meta.payment_info ||
      doc.payment_info ||
      "ธนาคารกสิกรไทย (KBANK) สาขารัชดาภิเษก | ชื่อบัญชี: บจก. อินเตอร์สปีดี้ เทคโนโลยี | เลขที่บัญชี: 012-3-45678-9",
    approver_name:
      meta.approver_name || doc.approver_name || doc.sales_owner || "",
    acceptor_name: meta.acceptor_name || doc.acceptor_name || "",
  };
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  const [formData, setFormData] = useState({
    doc_number: "",
    doc_date: "",
    valid_until: "",
    ref_number: "",
    seller_name: DEFAULT_SELLER.company_name,
    seller_address: DEFAULT_SELLER.address,
    seller_tax_id: DEFAULT_SELLER.tax_id,
    seller_logo: "",
    customer_name: "",
    customer_address: "",
    customer_tax_id: "",
    project_title: "",
    items: [{ ...DEFAULT_ITEM }],
    include_vat: true,
    status: "รออนุมัติ",
    sales_owner: "",
    source_channel: "React Web",
    payment_info:
      "ธนาคารกสิกรไทย (KBANK) สาขารัชดาภิเษก | ชื่อบัญชี: บจก. อินเตอร์สปีดี้ เทคโนโลยี | เลขที่บัญชี: 012-3-45678-9",
    approver_name: "",
    acceptor_name: "",
    notes: "",
  });

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3200);
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await QuotationService.fetchAll();
      setDocuments((data || []).map(parseQuotationRecord));
    } catch (err) {
      console.error(err);
      triggerToast("เกิดข้อผิดพลาดในการโหลดข้อมูลจาก Supabase");
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
        const num = parseInt(doc.doc_number.replace(prefix, ""), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
  };

  const openCreateModal = () => {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setDate(today.getDate() + 30);

    setEditingDoc(null);
    setFormData({
      doc_number: generateNextDocNumber(),
      doc_date: today.toISOString().split("T")[0],
      valid_until: nextMonth.toISOString().split("T")[0],
      ref_number: `REF-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      seller_name: DEFAULT_SELLER.company_name,
      seller_address: DEFAULT_SELLER.address,
      seller_tax_id: DEFAULT_SELLER.tax_id,
      seller_logo: "",
      customer_name: "",
      customer_address: "",
      customer_tax_id: "",
      project_title: "",
      items: [{ code: "SRV-001", description: "", qty: 1, unit_price: 0 }],
      include_vat: true,
      status: "รออนุมัติ",
      sales_owner: "",
      source_channel: "React Web",
      payment_info:
        "ธนาคารกสิกรไทย (KBANK) สาขารัชดาภิเษก | ชื่อบัญชี: บจก. อินเตอร์สปีดี้ เทคโนโลยี | เลขที่บัญชี: 012-3-45678-9",
      approver_name: "",
      acceptor_name: "",
      notes:
        "ยืนราคา 30 วัน นับจากวันที่ออกเอกสาร / ชำระมัดจำ 50% ก่อนเริ่มดำเนินงาน",
    });
    setIsFormOpen(true);
  };

  const openEditModal = (doc) => {
    const parsed = parseQuotationRecord(doc);
    setEditingDoc(parsed);
    setFormData({
      doc_number: parsed.doc_number || "",
      doc_date: parsed.doc_date || "",
      valid_until: parsed.valid_until || "",
      ref_number: parsed.ref_number === "-" ? "" : parsed.ref_number,
      seller_name: parsed.seller_name,
      seller_address: parsed.seller_address,
      seller_tax_id: parsed.seller_tax_id,
      seller_logo: parsed.seller_logo || "",
      customer_name: parsed.customer_name || "",
      customer_address:
        parsed.customer_address === "-" ? "" : parsed.customer_address,
      customer_tax_id:
        parsed.customer_tax_id === "-" ? "" : parsed.customer_tax_id,
      project_title: parsed.project_title || "",
      items: parsed.items.map((it) => ({
        code: it.code || "",
        description: it.description || "",
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price) || 0,
      })),
      include_vat: parsed.include_vat,
      status: parsed.status || "รออนุมัติ",
      sales_owner: parsed.sales_owner || "",
      source_channel: parsed.source_channel || "React Web",
      payment_info: parsed.payment_info || "",
      approver_name: parsed.approver_name || "",
      acceptor_name: parsed.acceptor_name || "",
      notes: parsed.cleanNotes || "",
    });
    setIsFormOpen(true);
  };

  // คำนวณยอดรวมในฟอร์มแบบ Real-time
  const formTotals = useMemo(() => {
    const subtotal = formData.items.reduce(
      (sum, item) =>
        sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0),
      0,
    );
    const vat = formData.include_vat ? subtotal * 0.07 : 0;
    const grandTotal = subtotal + vat;
    return { subtotal, vat, grandTotal };
  }, [formData.items, formData.include_vat]);

  // อัปโหลดโลโก้ขึ้น Supabase Storage (Bucket: quotation-logos)
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      triggerToast("กรุณาเลือกไฟล์รูปภาพขนาดไม่เกิน 2MB");
      return;
    }

    setUploadingLogo(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const fileExt = file.name.split(".").pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("quotation-logos")
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("quotation-logos")
          .getPublicUrl(fileName);

        setFormData((prev) => ({ ...prev, seller_logo: data.publicUrl }));
        triggerToast("อัปโหลดโลโก้ขึ้น Supabase Storage เรียบร้อยแล้ว");
      } else {
        throw new Error("Supabase not configured");
      }
    } catch (err) {
      console.warn("Storage upload fallback to Base64:", err);
      const reader = new FileReader();
      reader.onload = () => {
        setFormData((prev) => ({ ...prev, seller_logo: reader.result }));
        triggerToast("แนบโลโก้เรียบร้อยแล้ว");
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        [field]:
          field === "qty" || field === "unit_price" ? Number(value) : value,
      };
      return { ...prev, items: updated };
    });
  };

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          code: `SRV-${String(prev.items.length + 1).padStart(3, "0")}`,
          description: "",
          qty: 1,
          unit_price: 0,
        },
      ],
    }));
  };

  const removeLineItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = serializeQuotationPayload({
        ...formData,
        project_title:
          formData.project_title.trim() ||
          formData.items[0]?.description ||
          "ใบเสนอราคาสินค้าและบริการ",
        amount: formTotals.grandTotal,
      });

      if (editingDoc) {
        await QuotationService.update(editingDoc.id, payload);
        triggerToast(`อัปเดตใบเสนอราคา ${payload.doc_number} เรียบร้อยแล้ว`);
      } else {
        await QuotationService.create(payload);
        triggerToast(`บันทึกใบเสนอราคา ${payload.doc_number} ลงฐานข้อมูลแล้ว`);
      }
      setIsFormOpen(false);
      await loadDocuments();
    } catch (err) {
      console.error(err);
      triggerToast(
        "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ Supabase",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc) => {
    if (
      !window.confirm(
        `ยืนยันการลบใบเสนอราคา ${doc.doc_number} (${doc.customer_name}) ใช่หรือไม่?`,
      )
    ) {
      return;
    }
    try {
      await QuotationService.remove(doc.id);
      triggerToast(`ลบเอกสาร ${doc.doc_number} เรียบร้อยแล้ว`);
      await loadDocuments();
    } catch (err) {
      console.error(err);
      triggerToast("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const handleSimulateWixWebhook = async () => {
    setSaving(true);
    try {
      const nextNo = generateNextDocNumber();
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setDate(today.getDate() + 30);

      const payload = serializeQuotationPayload({
        doc_number: nextNo,
        doc_date: today.toISOString().split("T")[0],
        valid_until: nextMonth.toISOString().split("T")[0],
        ref_number: `WIX-${Math.floor(10000 + Math.random() * 90000)}`,
        seller_name: DEFAULT_SELLER.company_name,
        seller_address: DEFAULT_SELLER.address,
        seller_tax_id: DEFAULT_SELLER.tax_id,
        seller_logo: "",
        customer_name: "บริษัท สยามดิจิทัล เอ็นเตอร์ไพรส์ จำกัด",
        customer_address:
          "88 อาคารเอ็มไพร์ทาวเวอร์ ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพฯ 10120",
        customer_tax_id: "0105561098765",
        project_title: "พัฒนาระบบจัดการเอกสารและฐานข้อมูลบนคลาวด์ AWS",
        items: [
          {
            code: "CLD-101",
            description: "ออกแบบสถาปัตยกรรมฐานข้อมูล PostgreSQL บน AWS Cloud",
            qty: 1,
            unit_price: 85000,
          },
          {
            code: "WEB-202",
            description: "พัฒนาระบบหน้าบ้าน React Dashboard เชื่อมต่อ API",
            qty: 1,
            unit_price: 40000,
          },
        ],
        include_vat: true,
        amount: 133750,
        status: "รออนุมัติ",
        sales_owner: "คุณกิตติพงษ์ (Wix Auto-Assign)",
        source_channel: "Wix Portal",
        payment_info:
          "ธนาคารกสิกรไทย (KBANK) สาขารัชดาภิเษก | ชื่อบัญชี: บจก. อินเตอร์สปีดี้ เทคโนโลยี | เลขที่บัญชี: 012-3-45678-9",
        approver_name: "คุณกิตติพงษ์ วัฒนากูล",
        acceptor_name: "",
        notes:
          "ส่งข้อมูลอัตโนมัติผ่าน Wix Velo Backend ➔ Supabase ➔ AWS PostgreSQL",
      });

      await QuotationService.create(payload);
      triggerToast(`รับข้อมูลใบเสนอราคา ${nextNo} จาก Wix Portal สำเร็จ!`);
      await loadDocuments();
    } finally {
      setSaving(false);
    }
  };

  // สั่งพิมพ์ PDF แบบสะอาด ไม่ติดหัวกระดาษ/URL และตั้งชื่อไฟล์ตามเลขที่เอกสาร
  const triggerCleanPrint = (docNumber) => {
    const prevTitle = document.title;
    document.title = docNumber || "Quotation";
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 500);
  };

  const handlePrintPdf = (doc) => {
    const parsed = parseQuotationRecord(doc);
    setViewingDoc(parsed);
    setTimeout(() => {
      triggerCleanPrint(parsed.doc_number);
    }, 350);
  };

  const handleExportCsv = () => {
    const headers = [
      "เลขที่เอกสาร",
      "ลูกค้า",
      "หัวข้องาน",
      "วันที่ออก",
      "มูลค่าสุทธิ",
      "สถานะ",
      "ช่องทางที่มา",
    ];
    const rows = filteredDocs.map((d) => [
      d.doc_number,
      `"${(d.customer_name || "").replace(/"/g, '""')}"`,
      `"${(d.project_title || "").replace(/"/g, '""')}"`,
      d.doc_date,
      d.amount,
      d.status,
      d.source_channel || "React Web",
    ]);
    const csv =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotations-aws-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast("ส่งออกรายงาน CSV เรียบร้อยแล้ว");
  };

  const metrics = useMemo(() => {
    const totalCount = documents.length;
    const totalAmount = documents.reduce(
      (s, d) => s + Number(d.amount || 0),
      0,
    );
    const approved = documents.filter((d) => d.status === "อนุมัติแล้ว");
    const pending = documents.filter((d) => d.status === "รออนุมัติ");
    const draft = documents.filter((d) => d.status === "ฉบับร่าง");
    const cancelled = documents.filter((d) => d.status === "ยกเลิก");

    return {
      totalCount,
      totalAmount,
      approvedCount: approved.length,
      approvedAmount: approved.reduce((s, d) => s + Number(d.amount || 0), 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, d) => s + Number(d.amount || 0), 0),
      draftCount: draft.length,
      cancelledCount: cancelled.length,
    };
  }, [documents]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents
      .filter((doc) => {
        const matchStatus =
          statusFilter === "ALL" || doc.status === statusFilter;
        const matchQuery =
          !q ||
          (doc.doc_number || "").toLowerCase().includes(q) ||
          (doc.customer_name || "").toLowerCase().includes(q) ||
          (doc.project_title || "").toLowerCase().includes(q) ||
          (doc.source_channel || "").toLowerCase().includes(q);
        return matchStatus && matchQuery;
      })
      .sort((a, b) => {
        if (sortBy === "date-desc")
          return new Date(b.doc_date) - new Date(a.doc_date);
        if (sortBy === "date-asc")
          return new Date(a.doc_date) - new Date(b.doc_date);
        if (sortBy === "amount-desc")
          return Number(b.amount) - Number(a.amount);
        if (sortBy === "amount-asc") return Number(a.amount) - Number(b.amount);
        return 0;
      });
  }, [documents, statusFilter, searchQuery, sortBy]);

  const formatCurrency = (val) =>
    "฿" +
    Number(val || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatNumber = (val) =>
    Number(val || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatThaiDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // คำนวณยอดสำหรับหน้า Preview / Print PDF
  const viewingTotals = useMemo(() => {
    if (!viewingDoc) return { subtotal: 0, vat: 0, grandTotal: 0 };
    const subtotal = viewingDoc.items.reduce(
      (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
      0,
    );
    const vat = viewingDoc.include_vat ? subtotal * 0.07 : 0;
    const grandTotal = subtotal + vat;
    return { subtotal, vat, grandTotal };
  }, [viewingDoc]);

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-800">
      {/* CSS สำหรับการสั่งพิมพ์ A4 / Save as PDF (ซ่อนหัว/ท้ายกระดาษและ URL ของเบราว์เซอร์) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-quotation-sheet,
          #printable-quotation-sheet * {
            visibility: visible !important;
          }
          #printable-quotation-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 12mm 14mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            z-index: 99999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden backdrop-blur-xs no-print"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-40 w-72 bg-navy-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out shadow-xl ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
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
            {
              key: "ALL",
              label: "เอกสารทั้งหมด",
              icon: LayoutDashboard,
              count: metrics.totalCount,
              color: "text-white",
            },
            {
              key: "อนุมัติแล้ว",
              label: "อนุมัติแล้ว",
              icon: CheckCircle2,
              count: metrics.approvedCount,
              color: "text-emerald-400",
            },
            {
              key: "รออนุมัติ",
              label: "รออนุมัติ / ส่งแล้ว",
              icon: Clock,
              count: metrics.pendingCount,
              color: "text-amber-400",
            },
            {
              key: "ฉบับร่าง",
              label: "ฉบับร่าง (Draft)",
              icon: FileEdit,
              count: metrics.draftCount,
              color: "text-sky-400",
            },
            {
              key: "ยกเลิก",
              label: "ไม่อนุมัติ / ยกเลิก",
              icon: XCircle,
              count: metrics.cancelledCount,
              color: "text-rose-400",
            },
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
                    ? "bg-gradient-to-r from-brandOrange-500/25 to-brandOrange-500/5 text-white border-l-4 border-brandOrange-500"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                  {item.label}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    active
                      ? "bg-brandOrange-500 text-white"
                      : "bg-white/10 text-slate-200"
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
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {isSupabaseConfigured ? "Supabase Live" : "Demo Local"}
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
      <div className="flex-1 flex flex-col min-w-0 no-print">
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
                จัดการใบเสนอราคาและสั่งพิมพ์เอกสาร PDF มาตรฐาน
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
              <span>สร้างใบเสนอราคา</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* KPI CARDS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  ใบเสนอราคาทั้งหมด
                </p>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold text-navy-900 mt-1">
                  {metrics.totalCount} ฉบับ
                </h3>
                <p className="text-xs text-slate-400 mt-1.5">
                  รวมข้อมูลจาก React & Wix
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
                <Files className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-navy-800 to-navy-900 rounded-2xl p-5 text-white shadow-md flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">
                  มูลค่ารวมทั้งหมด
                </p>
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
                <p className="text-sm font-medium text-slate-500">
                  ยอดที่อนุมัติแล้ว
                </p>
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
                <p className="text-sm font-medium text-slate-500">
                  รอดำเนินการ / รออนุมัติ
                </p>
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
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin text-brandOrange-500" : ""}`}
                  />
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
                    <th className="py-3.5 px-5">ชื่อลูกค้า / ผู้ซื้อ</th>
                    <th className="py-3.5 px-5">หัวข้องาน / รายการ</th>
                    <th className="py-3.5 px-5">วันที่ออก / ใช้ได้ถึง</th>
                    <th className="py-3.5 px-5 text-right">มูลค่าสุทธิ</th>
                    <th className="py-3.5 px-5 text-center">สถานะ</th>
                    <th className="py-3.5 px-5 text-center">
                      จัดการ / พิมพ์ PDF
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredDocs.map((doc) => {
                    const st =
                      STATUS_CONFIG[doc.status] || STATUS_CONFIG["ฉบับร่าง"];
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-orange-50/40 transition-colors"
                      >
                        <td className="py-4 px-5 whitespace-nowrap">
                          <div className="font-heading font-semibold text-navy-800">
                            {doc.doc_number}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            อ้างอิง: {doc.ref_number || "-"}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-semibold text-slate-800">
                            {doc.customer_name}
                          </div>
                          <div className="text-xs text-slate-400">
                            Tax ID: {doc.customer_tax_id || "-"}
                          </div>
                        </td>
                        <td
                          className="py-4 px-5 text-slate-600 max-w-xs truncate"
                          title={doc.project_title}
                        >
                          <div>{doc.project_title}</div>
                          <div className="text-[11px] text-slate-400">
                            {doc.items?.length || 1} รายการ •{" "}
                            {doc.source_channel || "React Web"}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-slate-600 whitespace-nowrap text-xs">
                          <div>ออก: {formatThaiDate(doc.doc_date)}</div>
                          <div className="text-slate-400">
                            ถึง: {formatThaiDate(doc.valid_until)}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right font-heading font-bold text-navy-900 whitespace-nowrap">
                          {formatCurrency(doc.amount)}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.badge}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                            />
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() =>
                                setViewingDoc(parseQuotationRecord(doc))
                              }
                              title="ดูใบเสนอราคา"
                              className="p-2 rounded-lg text-slate-500 hover:text-navy-700 hover:bg-navy-50"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePrintPdf(doc)}
                              title="พิมพ์ / บันทึกเป็น PDF"
                              className="p-2 rounded-lg text-navy-700 hover:text-white hover:bg-navy-800"
                            >
                              <Printer className="w-4 h-4" />
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

            {/* MOBILE VIEW */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredDocs.map((doc) => {
                const st =
                  STATUS_CONFIG[doc.status] || STATUS_CONFIG["ฉบับร่าง"];
                return (
                  <div key={doc.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-heading font-bold text-brandOrange-600 bg-brandOrange-50 px-2.5 py-0.5 rounded-md">
                          {doc.doc_number}
                        </span>
                        <h4 className="font-semibold text-navy-900 text-base mt-1.5">
                          {doc.customer_name}
                        </h4>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${st.badge}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                        />
                        {doc.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600">
                      {doc.project_title}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <span>วันที่: {formatThaiDate(doc.doc_date)}</span>
                      <span className="font-heading font-bold text-base text-navy-900">
                        {formatCurrency(doc.amount)}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        onClick={() => setViewingDoc(parseQuotationRecord(doc))}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl bg-navy-50 text-navy-800 font-heading text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" /> ดู
                      </button>
                      <button
                        onClick={() => handlePrintPdf(doc)}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl bg-navy-800 text-white font-heading text-xs font-semibold"
                      >
                        <Printer className="w-3.5 h-3.5" /> PDF
                      </button>
                      <button
                        onClick={() => openEditModal(doc)}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl bg-brandOrange-50 text-brandOrange-700 font-heading text-xs font-semibold"
                      >
                        <Pencil className="w-3.5 h-3.5" /> แก้ไข
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl bg-rose-50 text-rose-700 font-heading text-xs font-semibold"
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
                <h4 className="font-heading font-semibold text-navy-900">
                  ไม่พบข้อมูลเอกสาร
                </h4>
                <p className="text-sm text-slate-500 mt-1">
                  ลองเปลี่ยนเงื่อนไขการค้นหา หรือกดปุ่ม "สร้างใบเสนอราคา"
                </p>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* =====================================================================
          MODAL 1: ฟอร์มสร้าง / แก้ไขใบเสนอราคา (ครบ Header / Description / Footer)
         ===================================================================== */}
      {isFormOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-navy-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-navy-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div>
                <h3 className="font-heading font-semibold text-lg">
                  {editingDoc
                    ? `แก้ไขใบเสนอราคา (${editingDoc.doc_number})`
                    : "สร้างใบเสนอราคาใหม่ (Quotation)"}
                </h3>
                <p className="text-xs text-slate-300">
                  กรอกข้อมูลส่วน Header, รายการสินค้า/บริการ (Description)
                  และส่วนท้ายเอกสาร (Footer)
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              className="p-6 space-y-6 overflow-y-auto"
            >
              {/* SECTION 1: HEADER */}
              <div className="space-y-4 border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/50">
                <div className="flex items-center gap-2 text-navy-900 font-heading font-bold text-sm border-b border-slate-200 pb-2">
                  <Building2 className="w-4 h-4 text-brandOrange-500" />
                  <span>
                    1. ส่วนหัวเอกสาร (Header): โลโก้ ข้อมูลผู้ขาย-ผู้ซื้อ
                    และเลขที่อ้างอิง
                  </span>
                </div>

                {/* เลขที่เอกสาร / วันที่ออก / ใช้ได้ถึง / เลขที่อ้างอิง */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                      เลขที่เอกสาร *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.doc_number}
                      onChange={(e) =>
                        setFormData({ ...formData, doc_number: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold text-navy-900"
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
                      onChange={(e) =>
                        setFormData({ ...formData, doc_date: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                      วันที่ใช้ได้ถึง
                    </label>
                    <input
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          valid_until: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                      เลขที่อ้างอิง (Ref No.)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น REF-2026-001"
                      value={formData.ref_number}
                      onChange={(e) =>
                        setFormData({ ...formData, ref_number: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                </div>

                {/* ข้อมูลฝั่งผู้ขาย & ผู้ซื้อ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* ฝั่งผู้ขาย */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-heading font-bold text-navy-800 uppercase">
                        ข้อมูลฝั่งผู้ขาย (Seller)
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-brandOrange-600 hover:text-brandOrange-700 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {uploadingLogo
                            ? "กำลังอัปโหลด..."
                            : "อัปโหลดโลโก้บริษัท"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingLogo}
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {formData.seller_logo && (
                      <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <img
                          src={formData.seller_logo}
                          alt="Company Logo"
                          className="h-10 w-auto object-contain"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, seller_logo: "" })
                          }
                          className="text-xs text-rose-600 hover:underline ml-auto"
                        >
                          ลบโลโก้
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        ชื่อบริษัท / ผู้ขาย *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.seller_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            seller_name: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        เลขประจำตัวผู้เสียภาษี (ผู้ขาย) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.seller_tax_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            seller_tax_id: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        ที่อยู่ผู้ขาย *
                      </label>
                      <textarea
                        rows="2"
                        required
                        value={formData.seller_address}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            seller_address: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  {/* ฝั่งผู้ซื้อ */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <span className="block text-xs font-heading font-bold text-brandOrange-600 uppercase">
                      ข้อมูลฝั่งผู้ซื้อ / ลูกค้า (Customer)
                    </span>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        ชื่อลูกค้า / บริษัทผู้ซื้อ *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น บริษัท สยามเทค อินโนเวชั่น จำกัด"
                        value={formData.customer_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_name: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        เลขประจำตัวผู้เสียภาษี (ผู้ซื้อ)
                      </label>
                      <input
                        type="text"
                        placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก"
                        value={formData.customer_tax_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_tax_id: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        ที่อยู่ผู้ซื้อ
                      </label>
                      <textarea
                        rows="2"
                        placeholder="ที่อยู่สำหรับออกใบเสนอราคา / ใบกำกับภาษี"
                        value={formData.customer_address}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_address: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: DESCRIPTION */}
              <div className="space-y-4 border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <span className="font-heading font-bold text-sm text-navy-900">
                    2. รายละเอียดสินค้า / บริการ (Description)
                  </span>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-900 text-white text-xs font-heading font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มรายการสินค้า/บริการ
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    ชื่อหัวข้อโครงการ / เรื่อง *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น เสนอราคาพัฒนาระบบฐานข้อมูลและเว็บไซต์องค์กร"
                    value={formData.project_title}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        project_title: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  />
                </div>

                <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-navy-900 text-white text-xs font-heading">
                        <th className="py-2.5 px-3 w-28">รหัสสินค้า/บริการ</th>
                        <th className="py-2.5 px-3">
                          คำอธิบายรายการของสินค้า/บริการ
                        </th>
                        <th className="py-2.5 px-3 w-24 text-right">จำนวน</th>
                        <th className="py-2.5 px-3 w-32 text-right">
                          ราคาต่อหน่วย
                        </th>
                        <th className="py-2.5 px-3 w-32 text-right">
                          มูลค่าก่อนภาษี
                        </th>
                        <th className="py-2.5 px-2 w-10 text-center">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.items.map((item, idx) => {
                        const lineTotal =
                          (Number(item.qty) || 0) *
                          (Number(item.unit_price) || 0);
                        return (
                          <tr key={idx}>
                            <td className="p-2">
                              <input
                                type="text"
                                required
                                value={item.code}
                                onChange={(e) =>
                                  handleItemChange(idx, "code", e.target.value)
                                }
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                required
                                placeholder="ระบุรายละเอียดสินค้าหรือขอบเขตบริการ..."
                                value={item.description}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "description",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                required
                                value={item.qty}
                                onChange={(e) =>
                                  handleItemChange(idx, "qty", e.target.value)
                                }
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs text-right"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={item.unit_price}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "unit_price",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs text-right"
                              />
                            </td>
                            <td className="p-2 text-right font-heading font-semibold text-navy-900 text-xs whitespace-nowrap">
                              {formatNumber(lineTotal)}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(idx)}
                                disabled={formData.items.length <= 1}
                                className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* สรุปยอดเงิน & หมายเหตุ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div>
                    <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                      หมายเหตุ (Notes)
                    </label>
                    <textarea
                      rows="3"
                      placeholder="เงื่อนไขการรับประกัน ระยะเวลาส่งมอบ หรือหมายเหตุเพิ่มเติม..."
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>รวมมูลค่าก่อนภาษี (Subtotal):</span>
                      <span className="font-semibold">
                        {formatCurrency(formTotals.subtotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.include_vat}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              include_vat: e.target.checked,
                            })
                          }
                          className="rounded text-brandOrange-500 focus:ring-brandOrange-500"
                        />
                        <span>ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                      </label>
                      <span className="font-semibold">
                        {formatCurrency(formTotals.vat)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 text-base font-heading font-bold text-navy-900">
                      <span>ยอดรวมสุทธิ (Grand Total):</span>
                      <span className="text-brandOrange-600">
                        {formatCurrency(formTotals.grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: FOOTER */}
              <div className="space-y-4 border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/50">
                <div className="flex items-center gap-2 text-navy-900 font-heading font-bold text-sm border-b border-slate-200 pb-2">
                  <CreditCard className="w-4 h-4 text-brandOrange-500" />
                  <span>
                    3. ส่วนท้ายเอกสาร (Footer): ช่องทางการชำระเงิน
                    และผู้อนุมัติ/ผู้ยอมรับ
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                    ช่องทางการชำระเงิน (บัญชีธนาคาร / พร้อมเพย์)
                  </label>
                  <input
                    type="text"
                    value={formData.payment_info}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_info: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                      ชื่อผู้อนุมัติ (ฝั่งผู้ขาย)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น คุณกิตติพงษ์ วัฒนากูล"
                      value={formData.approver_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          approver_name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                      ชื่อผู้ยอมรับ (ฝั่งผู้ซื้อ)
                    </label>
                    <input
                      type="text"
                      placeholder="เว้นว่างไว้ให้ลูกค้าเซ็นได้"
                      value={formData.acceptor_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          acceptor_name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                      สถานะเอกสาร *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    >
                      <option value="ฉบับร่าง">ฉบับร่าง</option>
                      <option value="รออนุมัติ">รออนุมัติ</option>
                      <option value="อนุมัติแล้ว">อนุมัติแล้ว</option>
                      <option value="ยกเลิก">ยกเลิก</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-heading font-semibold text-navy-800 mb-1">
                      ผู้รับผิดชอบ / ช่องทาง
                    </label>
                    <input
                      type="text"
                      placeholder="ชื่อพนักงานขาย"
                      value={formData.sales_owner}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sales_owner: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-heading text-sm font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingLogo}
                  className="px-6 py-2.5 rounded-xl bg-brandOrange-500 hover:bg-brandOrange-600 text-white font-heading text-sm font-semibold shadow-md disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกใบเสนอราคา"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: หน้าตัวอย่างใบเสนอราคา A4 + ปุ่มสั่งพิมพ์ / บันทึกเป็น PDF
         ===================================================================== */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-navy-900/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* แถบควบคุมด้านบน (ซ่อนอัตโนมัติเวลาสั่งพิมพ์ PDF) */}
            <div className="no-print bg-navy-900 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-heading uppercase tracking-wider bg-brandOrange-500 text-white px-2.5 py-0.5 rounded-md font-bold">
                  A4 Preview
                </span>
                <h3 className="font-heading font-semibold text-base">
                  ใบเสนอราคาเลขที่ {viewingDoc.doc_number}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerCleanPrint(viewingDoc.doc_number)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brandOrange-500 hover:bg-brandOrange-600 text-white font-heading text-sm font-semibold shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์ / บันทึกเป็น PDF</span>
                </button>
                <button
                  onClick={() => {
                    const target = viewingDoc;
                    setViewingDoc(null);
                    openEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-heading text-sm"
                >
                  <Pencil className="w-4 h-4" /> แก้ไข
                </button>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 rounded-lg text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* พื้นที่กระดาษใบเสนอราคา A4 สำหรับพิมพ์ PDF */}
            <div className="max-h-[82vh] overflow-y-auto p-4 sm:p-8 bg-slate-200/60">
              <div
                id="printable-quotation-sheet"
                className="bg-white mx-auto p-6 sm:p-10 shadow-md border border-slate-200 text-slate-800 space-y-6 max-w-[210mm]"
              >
                {/* 1. HEADER: โลโก้ + ผู้ขาย/ผู้ซื้อ + เลขที่เอกสาร/วันที่/ใช้ได้ถึง/อ้างอิง */}
                <div className="flex flex-col sm:flex-row justify-between gap-6 border-b-2 border-navy-900 pb-6">
                  {/* โลโก้และข้อมูลผู้ขาย */}
                  <div className="space-y-2 max-w-md">
                    <div className="flex items-center gap-3">
                      {viewingDoc.seller_logo ? (
                        <img
                          src={viewingDoc.seller_logo}
                          alt="Logo"
                          className="h-14 w-auto object-contain"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-navy-900 text-brandOrange-500 flex items-center justify-center font-heading font-bold text-xl">
                          QT
                        </div>
                      )}
                      <div>
                        <h1 className="font-heading font-bold text-lg text-navy-900">
                          {viewingDoc.seller_name}
                        </h1>
                        <p className="text-xs text-slate-600">
                          เลขประจำตัวผู้เสียภาษี: {viewingDoc.seller_tax_id}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      ที่อยู่: {viewingDoc.seller_address}
                    </p>
                  </div>

                  {/* หัวข้อใบเสนอราคาและเลขที่อ้างอิง */}
                  <div className="sm:text-right space-y-1.5">
                    <div className="inline-block bg-navy-900 text-white px-4 py-1.5 rounded-lg">
                      <h2 className="font-heading font-bold text-lg tracking-wide">
                        ใบเสนอราคา / QUOTATION
                      </h2>
                    </div>
                    <div className="text-xs space-y-1 pt-1">
                      <p>
                        <span className="text-slate-500">เลขที่เอกสาร:</span>{" "}
                        <strong className="text-navy-900 font-heading">
                          {viewingDoc.doc_number}
                        </strong>
                      </p>
                      <p>
                        <span className="text-slate-500">วันที่ออกเอกสาร:</span>{" "}
                        <strong>{formatThaiDate(viewingDoc.doc_date)}</strong>
                      </p>
                      <p>
                        <span className="text-slate-500">วันที่ใช้ได้ถึง:</span>{" "}
                        <strong>
                          {formatThaiDate(viewingDoc.valid_until)}
                        </strong>
                      </p>
                      <p>
                        <span className="text-slate-500">เลขที่อ้างอิง:</span>{" "}
                        <strong>{viewingDoc.ref_number || "-"}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* ข้อมูลผู้ซื้อ (Customer) */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-heading font-bold text-brandOrange-600 uppercase">
                      เสนอราคาให้แก่ (ผู้ซื้อ / ลูกค้า)
                    </p>
                    <p className="font-heading font-bold text-base text-navy-900">
                      {viewingDoc.customer_name}
                    </p>
                    <p className="text-xs text-slate-600">
                      ที่อยู่: {viewingDoc.customer_address || "-"}
                    </p>
                    <p className="text-xs text-slate-600">
                      เลขประจำตัวผู้เสียภาษี:{" "}
                      {viewingDoc.customer_tax_id || "-"}
                    </p>
                  </div>
                  <div className="sm:text-right space-y-1 text-xs">
                    <p className="text-slate-500">เรื่อง / โครงการ:</p>
                    <p className="font-semibold text-navy-900 text-sm max-w-xs">
                      {viewingDoc.project_title}
                    </p>
                  </div>
                </div>

                {/* 2. DESCRIPTION: ตารางรายการสินค้า/บริการ */}
                <div>
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-white font-heading">
                        <th className="border border-slate-300 py-2.5 px-3 text-center w-12">
                          ลำดับ
                        </th>
                        <th className="border border-slate-300 py-2.5 px-3 text-left w-28">
                          รหัสสินค้า/บริการ
                        </th>
                        <th className="border border-slate-300 py-2.5 px-3 text-left">
                          คำอธิบายรายการของสินค้า/บริการ
                        </th>
                        <th className="border border-slate-300 py-2.5 px-3 text-right w-20">
                          จำนวน
                        </th>
                        <th className="border border-slate-300 py-2.5 px-3 text-right w-28">
                          ราคาต่อหน่วย
                        </th>
                        <th className="border border-slate-300 py-2.5 px-3 text-right w-32">
                          มูลค่าก่อนภาษี
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingDoc.items.map((item, index) => {
                        const lineAmt =
                          (Number(item.qty) || 0) *
                          (Number(item.unit_price) || 0);
                        return (
                          <tr key={index}>
                            <td className="border border-slate-300 py-2.5 px-3 text-center">
                              {index + 1}
                            </td>
                            <td className="border border-slate-300 py-2.5 px-3 font-semibold text-navy-800">
                              {item.code || "-"}
                            </td>
                            <td className="border border-slate-300 py-2.5 px-3">
                              {item.description}
                            </td>
                            <td className="border border-slate-300 py-2.5 px-3 text-right">
                              {Number(item.qty || 0).toLocaleString("th-TH")}
                            </td>
                            <td className="border border-slate-300 py-2.5 px-3 text-right">
                              {formatNumber(item.unit_price)}
                            </td>
                            <td className="border border-slate-300 py-2.5 px-3 text-right font-semibold">
                              {formatNumber(lineAmt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* สรุปยอดเงินและหมายเหตุ */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mt-4">
                    <div className="sm:col-span-7 border border-slate-200 rounded-xl p-3.5 bg-slate-50/70">
                      <p className="text-xs font-heading font-bold text-navy-900 mb-1">
                        หมายเหตุ:
                      </p>
                      <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                        {viewingDoc.cleanNotes || "-"}
                      </p>
                    </div>

                    <div className="sm:col-span-5 border border-slate-300 rounded-xl overflow-hidden text-xs">
                      <div className="flex justify-between px-3.5 py-2 border-b border-slate-200">
                        <span className="text-slate-600">
                          มูลค่าก่อนภาษี (Subtotal)
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(viewingTotals.subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between px-3.5 py-2 border-b border-slate-200">
                        <span className="text-slate-600">
                          ภาษีมูลค่าเพิ่ม {viewingDoc.include_vat ? "7%" : "0%"}{" "}
                          (VAT)
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(viewingTotals.vat)}
                        </span>
                      </div>
                      <div className="flex justify-between px-3.5 py-2.5 bg-navy-900 text-white font-heading font-bold text-sm">
                        <span>ยอดรวมสุทธิ (Total)</span>
                        <span className="text-brandOrange-400">
                          {formatCurrency(
                            viewingTotals.grandTotal > 0
                              ? viewingTotals.grandTotal
                              : viewingDoc.amount,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. FOOTER: ช่องทางการชำระเงิน + ช่องผู้อนุมัติและช่องยอมรับใบเสนอราคา */}
                <div className="pt-4 border-t border-slate-300 space-y-6">
                  <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-3.5 text-xs">
                    <p className="font-heading font-bold text-navy-900 mb-0.5">
                      ช่องทางการชำระเงิน (Payment Information):
                    </p>
                    <p className="text-slate-700">{viewingDoc.payment_info}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-2 text-xs text-center">
                    {/* ช่องยอมรับใบเสนอราคา (ผู้ซื้อ) */}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-8">
                      <p className="font-heading font-semibold text-navy-900">
                        สำหรับลูกค้า (ยอมรับใบเสนอราคา)
                      </p>
                      <div className="space-y-1.5">
                        <div className="border-b border-dotted border-slate-400 w-4/5 mx-auto pt-4" />
                        <p className="text-slate-700">
                          (
                          {viewingDoc.acceptor_name ||
                            "...................................................."}
                          )
                        </p>
                        <p className="text-slate-500">
                          ผู้มีอำนาจลงนาม / ผู้ยอมรับใบเสนอราคา
                        </p>
                        <p className="text-slate-400">
                          วันที่ ........../........../..........
                        </p>
                      </div>
                    </div>

                    {/* ช่องผู้อนุมัติ (ผู้ขาย) */}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-8">
                      <p className="font-heading font-semibold text-navy-900">
                        ในนาม {viewingDoc.seller_name}
                      </p>
                      <div className="space-y-1.5">
                        <div className="border-b border-dotted border-slate-400 w-4/5 mx-auto pt-4" />
                        <p className="text-slate-700">
                          (
                          {viewingDoc.approver_name ||
                            "...................................................."}
                          )
                        </p>
                        <p className="text-slate-500">ผู้อนุมัติใบเสนอราคา</p>
                        <p className="text-slate-400">
                          วันที่ {formatThaiDate(viewingDoc.doc_date)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="no-print fixed bottom-5 right-5 z-50 bg-navy-900 text-white px-4 py-3 rounded-xl shadow-xl border-l-4 border-brandOrange-500 text-sm font-medium">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
