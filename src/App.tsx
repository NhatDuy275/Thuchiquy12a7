import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

type TransactionType = 'income' | 'expense';

type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  note: string;
  date: string;

  // Dữ liệu mở rộng được lưu trong note
  name?: string;
  quantity?: number;
  unitAmount?: number;
  createdAt?: number;
};

type Tab = 'overview' | 'income' | 'expense' | 'summary' | 'history';

type DraftExpense = {
  id: string;
  name: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  note: string;
};

const OTHER_OPTION = '__other__';

const META_PREFIX = '__FUND_META__:';

/* ============================================================
   HÀM TIỆN ÍCH
   ============================================================ */

const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

const formatVND = (value: number) => `${formatMoney(value)} VND`;

function todayISO() {
  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

function formatDate(date: string) {
  if (!date) return '';

  const value = date.includes('T') ? date.slice(0, 10) : date;

  const [y, m, d] = value.split('-');

  if (!y || !m || !d) {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  return `${d}/${m}/${y}`;
}

function getDateOnly(date: string) {
  return date ? date.slice(0, 10) : '';
}

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    'id_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 9)
  );
}

/*
 * File 2 chỉ có cột note.
 * Ta lưu dữ liệu mở rộng của file 1 trong note.
 */
function encodeNote(
  note: string,
  data: {
    name?: string;
    quantity?: number;
    unitAmount?: number;
    createdAt?: number;
  }
) {
  return (
    META_PREFIX +
    JSON.stringify({
      ...data,
      note: note || '',
    })
  );
}

function decodeNote(note: string) {
  if (!note || !note.startsWith(META_PREFIX)) {
    return {
      note: note || '',
    };
  }

  try {
    const json = note.slice(META_PREFIX.length);
    const parsed = JSON.parse(json);

    return {
      note: parsed.note || '',
      name: parsed.name,
      quantity: parsed.quantity,
      unitAmount: parsed.unitAmount,
      createdAt: parsed.createdAt,
    };
  } catch {
    return {
      note: note || '',
    };
  }
}

function normalizeTransaction(item: any): Transaction {
  const meta = decodeNote(item.note || '');

  return {
    id: item.id,
    type: item.type,
    amount: Number(item.amount) || 0,
    note: meta.note || '',
    date: getDateOnly(item.date),
    name: meta.name,
    quantity: meta.quantity !== undefined ? Number(meta.quantity) : undefined,
    unitAmount:
      meta.unitAmount !== undefined ? Number(meta.unitAmount) : undefined,
    createdAt:
      meta.createdAt !== undefined ? Number(meta.createdAt) : undefined,
  };
}

function getTransactionName(transaction: Transaction) {
  if (transaction.type === 'income') {
    return 'Đóng quỹ';
  }

  return transaction.name || transaction.note || 'Khoản chi';
}

function getQuantity(transaction: Transaction) {
  return Number(transaction.quantity) || 1;
}

function getUnitAmount(transaction: Transaction) {
  if (transaction.unitAmount !== undefined && transaction.unitAmount !== null) {
    return Number(transaction.unitAmount);
  }

  const quantity = getQuantity(transaction);

  if (quantity > 0) {
    return Number(transaction.amount) / quantity;
  }

  return Number(transaction.amount);
}

/* ============================================================
   ICON
   ============================================================ */

function Icon({
  children,
  size = 24,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function WalletIcon({ size = 28 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 7V5.5A2.5 2.5 0 0 0 17.5 3H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6" />
        <path d="M20 9h-4a2 2 0 0 0 0 4h4" />
        <circle cx="16" cy="11" r=".5" fill="currentColor" />
      </svg>
    </Icon>
  );
}

function TrendUpIcon({ size = 28 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 17 9 11l4 4 8-8" />
        <path d="M15 7h6v6" />
      </svg>
    </Icon>
  );
}

function TrendDownIcon({ size = 28 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 7 6 6 4-4 8 8" />
        <path d="M15 17h6v-6" />
      </svg>
    </Icon>
  );
}

function BankIcon({ size = 28 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 9 9-5 9 5" />
        <path d="M5 10h14" />
        <path d="M6 10v8" />
        <path d="M10 10v8" />
        <path d="M14 10v8" />
        <path d="M18 10v8" />
        <path d="M4 18h16" />
        <path d="M3 21h18" />
      </svg>
    </Icon>
  );
}

function ClipboardIcon({ size = 28 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V2h6v2" />
        <path d="M9 10h6" />
        <path d="M9 14h6" />
        <path d="M9 18h3" />
      </svg>
    </Icon>
  );
}

function GridIcon({ size = 25 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </svg>
    </Icon>
  );
}

function PlusIcon({ size = 22 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </Icon>
  );
}

function TrashIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </svg>
    </Icon>
  );
}

function PencilIcon({ size = 17 }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </svg>
    </Icon>
  );
}

/* ============================================================
   APP
   ============================================================ */

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);

  const [formType, setFormType] = useState<TransactionType>('income');

  const [date, setDate] = useState(todayISO());

  const [nameChoice, setNameChoice] = useState(OTHER_OPTION);

  const [customName, setCustomName] = useState('');

  const [quantity, setQuantity] = useState('1');

  const [unitAmount, setUnitAmount] = useState('');

  const [note, setNote] = useState('');

  const [draftItems, setDraftItems] = useState<DraftExpense[]>([]);

  const [editTransaction, setEditTransaction] = useState<Transaction | null>(
    null
  );

  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(
    null
  );

  const [fromDate, setFromDate] = useState('');

  const [toDate, setToDate] = useState('');

  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  /* ============================================================
     LOAD SUPABASE
     ============================================================ */

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('transactions')
      .select('id,type,amount,note,date')
      .order('date', {
        ascending: false,
      });

    if (error) {
      console.error('SUPABASE LOAD ERROR:', error);

      console.error('MESSAGE:', error.message);

      console.error('CODE:', error.code);

      console.error('DETAILS:', error.details);

      console.error('HINT:', error.hint);

      setError(`Không thể tải dữ liệu: ${error.message}`);

      setLoading(false);
      return;
    }

    setTransactions((data ?? []).map(normalizeTransaction));

    setLoading(false);
  }

  /* ============================================================
     TOTAL
     ============================================================ */

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((item) => item.type === 'income')
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [transactions]
  );

  const totalExpense = useMemo(
    () =>
      transactions
        .filter((item) => item.type === 'expense')
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [transactions]
  );

  const balance = totalIncome - totalExpense;

  /* ============================================================
     DANH SÁCH TÊN KHOẢN CHI ĐÃ CÓ
     ============================================================ */

  const knownExpenseNames = useMemo(
    () =>
      Array.from(
        new Set(
          transactions
            .filter((item) => item.type === 'expense')
            .map((item) => item.name)
            .filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b, 'vi')),
    [transactions]
  );

  /* ============================================================
     FORM
     ============================================================ */

  function resetForm() {
    setDate(todayISO());
    setNameChoice(OTHER_OPTION);
    setCustomName('');
    setQuantity('1');
    setUnitAmount('');
    setNote('');
    setDraftItems([]);
  }

  function openForm(type: TransactionType) {
    setFormType(type);
    resetForm();
    setError('');
    setShowForm(true);
  }

  const effectiveName =
    nameChoice === OTHER_OPTION ? customName.trim() : nameChoice;

  const lineTotal = (Number(quantity) || 0) * (Number(unitAmount) || 0);

  const canAddLine =
    !!date && !!effectiveName && Number(quantity) > 0 && Number(unitAmount) > 0;

  /* ============================================================
     THÊM KHOẢN THU
     ============================================================ */

  async function addIncome() {
    const numericQuantity = Number(quantity) || 0;

    const numericUnitAmount = Number(unitAmount) || 0;

    const total = numericQuantity * numericUnitAmount;

    if (!date || numericQuantity <= 0 || numericUnitAmount <= 0) {
      setError('Vui lòng nhập ngày, số lượng và đơn giá hợp lệ.');
      return;
    }

    setError('');

    const createdAt = Date.now();

    const encodedNote = encodeNote('', {
      name: 'Đóng quỹ',
      quantity: numericQuantity,
      unitAmount: numericUnitAmount,
      createdAt,
    });

    const { data, error } = await supabase
      .from('transactions')
      .insert({
       id: uid(), 
        type: 'income',
        amount: total,
        note: encodedNote,
        date,
      })
      .select('id,type,amount,note,date')
      .single();

    if (error) {
      console.error(error);

      setError(`Không thể lưu khoản thu: ${error.message}`);

      return;
    }

    setTransactions((current) => [normalizeTransaction(data), ...current]);

    setShowForm(false);
    resetForm();
  }

  /* ============================================================
     THÊM KHOẢN CHI VÀO GIỎ TẠM
     ============================================================ */

  function addDraftExpense() {
    if (!canAddLine) return;

    const item: DraftExpense = {
      id: uid(),
      name: effectiveName,
      quantity: Number(quantity),
      unitAmount: Number(unitAmount),
      totalAmount: lineTotal,
      note: note.trim(),
    };

    setDraftItems((current) => [...current, item]);

    setNameChoice(OTHER_OPTION);
    setCustomName('');
    setQuantity('1');
    setUnitAmount('');
    setNote('');
  }

  function editDraftExpense(item: DraftExpense) {
    setDraftItems((current) => current.filter((draft) => draft.id !== item.id));

    if (knownExpenseNames.includes(item.name)) {
      setNameChoice(item.name);
      setCustomName('');
    } else {
      setNameChoice(OTHER_OPTION);
      setCustomName(item.name);
    }

    setQuantity(String(item.quantity));

    setUnitAmount(String(item.unitAmount));

    setNote(item.note);
  }

  function removeDraftExpense(id: string) {
    setDraftItems((current) => current.filter((item) => item.id !== id));
  }

  /* ============================================================
     LƯU TOÀN BỘ GIỎ CHI VÀO SUPABASE
     ============================================================ */

  async function commitExpenses() {
    if (draftItems.length === 0) {
      return;
    }

    setError('');

    const rows = draftItems.map((item, index) => ({
      id: uid(), 
      type: 'expense' as const,
      amount: item.totalAmount,
      note: encodeNote(item.note, {
        name: item.name,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        createdAt: Date.now() + index,
      }),
      date,
    }));

    const { data, error } = await supabase
      .from('transactions')
      .insert(rows)
      .select('id,type,amount,note,date');

    if (error) {
      console.error(error);

      setError(`Không thể lưu khoản chi: ${error.message}`);

      return;
    }

    const newTransactions = (data ?? []).map(normalizeTransaction);

    setTransactions((current) => [...newTransactions, ...current]);

    setDraftItems([]);
    setShowForm(false);
    resetForm();
  }

  /* ============================================================
     XÓA
     ============================================================ */

  async function confirmDelete() {
    if (!deleteTransactionId) {
      return;
    }

    const id = deleteTransactionId;

    setError('');

    const { error } = await supabase.from('transactions').delete().eq('id', id);

    if (error) {
      console.error(error);

      setError(`Không thể xóa giao dịch: ${error.message}`);

      return;
    }

    setTransactions((current) =>
      current.filter((transaction) => transaction.id !== id)
    );

    setDeleteTransactionId(null);
  }

  /* ============================================================
     SỬA GIAO DỊCH
     ============================================================ */

  async function saveEdit(transaction: Transaction) {
    const total =
      (Number(transaction.quantity) || 0) *
      (Number(transaction.unitAmount) || 0);

    const finalAmount = total > 0 ? total : Number(transaction.amount);

    const finalName =
      transaction.type === 'income'
        ? 'Đóng quỹ'
        : transaction.name || 'Khoản chi';

    const encodedNote = encodeNote(transaction.note, {
      name: finalName,
      quantity: Number(transaction.quantity) || 1,
      unitAmount: Number(transaction.unitAmount) || finalAmount,
      createdAt: transaction.createdAt || Date.now(),
    });

    setError('');

    const { data, error } = await supabase
      .from('transactions')
      .update({
        type: transaction.type,
        amount: finalAmount,
        note: encodedNote,
        date: transaction.date,
      })
      .eq('id', transaction.id)
      .select('id,type,amount,note,date')
      .single();

    if (error) {
      console.error(error);

      setError(`Không thể cập nhật giao dịch: ${error.message}`);

      return;
    }

    const updated = normalizeTransaction(data);

    setTransactions((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    );

    setEditTransaction(null);
  }

  /* ============================================================
     TRANSACTION FILTER
     ============================================================ */

  const filteredHistory = useMemo(() => {
    let list = [...transactions];

    if (activeTab === 'income') {
      list = list.filter((item) => item.type === 'income');
    }

    if (activeTab === 'expense') {
      list = list.filter((item) => item.type === 'expense');
    }

    if (fromDate) {
      list = list.filter((item) => item.date >= fromDate);
    }

    if (toDate) {
      list = list.filter((item) => item.date <= toDate);
    }

    list.sort((a, b) => {
      if (a.date !== b.date) {
        return sortDirection === 'desc'
          ? a.date < b.date
            ? 1
            : -1
          : a.date < b.date
          ? -1
          : 1;
      }

      return sortDirection === 'desc'
        ? (b.createdAt || 0) - (a.createdAt || 0)
        : (a.createdAt || 0) - (b.createdAt || 0);
    });

    return list;
  }, [transactions, activeTab, fromDate, toDate, sortDirection]);

  /* ============================================================
     RENDER
     ============================================================ */

  const tabs: {
    key: Tab;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'overview',
      label: 'Tổng quan',
      icon: <GridIcon size={24} />,
    },
    {
      key: 'income',
      label: 'Thu',
      icon: <TrendUpIcon size={24} />,
    },
    {
      key: 'expense',
      label: 'Chi',
      icon: <TrendDownIcon size={24} />,
    },
    {
      key: 'summary',
      label: 'Tổng kết',
      icon: <BankIcon size={24} />,
    },
    {
      key: 'history',
      label: 'Lịch sử',
      icon: <ClipboardIcon size={24} />,
    },
  ];

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          min-height: 100%;
          width: 100%;
        }

        body {
          background: #292515;
          color: #e8e2d5;
          font-family: Georgia, "Times New Roman", serif;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
          background:
            repeating-linear-gradient(
              to bottom,
              rgba(232,226,213,.07) 0,
              rgba(232,226,213,.07) 1px,
              transparent 1px,
              transparent 48px
            ),
            #292515;
          padding-bottom: 105px;
        }

        .topbar {
          height: 88px;
          border-bottom: 1px solid rgba(232,226,213,.45);
          display: flex;
          align-items: center;
          padding: 0 24px;
          background: rgba(38,34,19,.96);
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 15px;
          font-size: 29px;
          font-weight: 700;
        }

        .brand-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #18332c;
        }

        .content {
          width: min(100% - 24px, 1100px);
          margin: 0 auto;
          padding: 25px 0 40px;
        }

        .page-title {
          margin: 0;
          font-size: 39px;
          line-height: 1.15;
        }

        .subtitle {
          margin: 10px 0 36px;
          color: #bcb5a8;
          font-size: 22px;
          line-height: 1.4;
        }

        .warning {
          margin-bottom: 22px;
          padding: 13px 16px;
          border: 1px solid rgba(196,101,70,.35);
          background: rgba(116,45,28,.32);
          color: #df8060;
          font-family: Arial, sans-serif;
          font-size: 16px;
          text-align: center;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 28px 26px;
        }

        .card {
          min-height: 176px;
          position: relative;
          overflow: hidden;
          border: 1px solid #41443f;
          border-radius: 12px;
          background: #171b1b;
          padding: 37px 30px 27px;
          box-shadow: 0 3px 0 rgba(0,0,0,.3);
        }

        .card::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 10px;
          background:
            repeating-linear-gradient(
              135deg,
              #22261f 0,
              #22261f 10px,
              #151915 10px,
              #151915 17px
            );
        }

        .card-label {
          color: #aaa69c;
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .card-icon {
          position: absolute;
          top: 30px;
          right: 30px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card.income .card-icon {
          color: #8ed1b6;
          background: #123b2b;
        }

        .card.expense .card-icon {
          color: #db7658;
          background: #4a2113;
        }

        .card.balance .card-icon {
          color: #d8aa50;
          background: #4a3709;
        }

        .card.count .card-icon {
          color: #ddd9cf;
          background: #302b1b;
        }

        .card-value {
          margin-top: 34px;
          font-family: "Courier New", monospace;
          font-size: 45px;
          font-weight: 700;
          letter-spacing: 1px;
          padding-right: 45px;
          word-break: break-word;
        }

        .income .card-value {
          color: #8ed1b6;
        }

        .expense .card-value {
          color: #db7658;
        }

        .balance .card-value {
          color: #d8aa50;
        }

        .count .card-value {
          color: #ddd9cf;
        }

        .actions {
          display: flex;
          gap: 18px;
          margin-top: 34px;
        }

        .action-button {
          flex: 1;
          min-height: 70px;
          border: 1px solid #41443f;
          border-radius: 10px;
          background: #171b1b;
          color: #ddd9cf;
          padding: 10px 16px;
          text-align: left;
          transition: transform .15s,background .15s;
        }

        .action-button:hover {
          transform: translateY(-2px);
          background: #202523;
        }

        .action-button-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 700;
        }

        .action-button small {
          display: block;
          margin-top: 4px;
          color: #8e8b82;
          font-family: Arial, sans-serif;
          font-size: 13px;
        }

        .action-button.income {
          color: #75bda1;
        }

        .action-button.expense {
          color: #d56e50;
        }

        .panel {
          border: 1px solid #41443f;
          border-radius: 12px;
          background: #171b1b;
          overflow: hidden;
        }

        .panel-header {
          padding: 20px 22px;
          border-bottom: 1px solid #3b3d38;
        }

        .panel-title {
          margin: 0;
          font-size: 25px;
        }

        .transaction {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 22px;
          border-bottom: 1px solid #30332e;
        }

        .transaction:last-child {
          border-bottom: 0;
        }

        .transaction-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .transaction.income .transaction-icon {
          background: #123b2b;
          color: #8ed1b6;
        }

        .transaction.expense .transaction-icon {
          background: #4a2113;
          color: #db7658;
        }

        .transaction-info {
          flex: 1;
          min-width: 0;
        }

        .transaction-note {
          font-size: 18px;
          margin-bottom: 4px;
        }

        .transaction-date {
          color: #89877f;
          font-family: Arial, sans-serif;
          font-size: 13px;
        }

        .transaction-detail {
          color: #77776f;
          font-family: Arial, sans-serif;
          font-size: 12px;
          margin-top: 4px;
        }

        .transaction-amount {
          font-family: "Courier New", monospace;
          font-size: 18px;
          font-weight: 700;
          white-space: nowrap;
        }

        .transaction.income .transaction-amount {
          color: #8ed1b6;
        }

        .transaction.expense .transaction-amount {
          color: #db7658;
        }

        .transaction-actions {
          display: flex;
          gap: 5px;
        }

        .delete-button,
        .edit-button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #77776f;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .delete-button:hover {
          background: #3a241c;
          color: #db7658;
        }

        .edit-button:hover {
          background: #25332e;
          color: #8ed1b6;
        }

        .empty {
          padding: 45px 20px;
          text-align: center;
          color: #85837b;
          font-family: Arial, sans-serif;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 18px;
        }

        .summary-item {
          border: 1px solid #41443f;
          border-radius: 10px;
          background: #171b1b;
          padding: 22px;
        }

        .summary-item-label {
          color: #aaa69c;
          font-family: Arial, sans-serif;
          font-size: 14px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .summary-item-value {
          margin-top: 12px;
          font-family: "Courier New", monospace;
          font-size: 25px;
          font-weight: 700;
        }

        .filter-box {
          border: 1px solid #41443f;
          border-radius: 12px;
          background: #171b1b;
          padding: 18px;
          margin-bottom: 22px;
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          align-items: end;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .filter-label {
          color: #aaa69c;
          font-family: Arial, sans-serif;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .filter-input {
          height: 43px;
          border: 1px solid #494c46;
          border-radius: 8px;
          outline: none;
          background: #101313;
          color: #e8e2d5;
          padding: 0 12px;
          font-family: Arial, sans-serif;
        }

        .filter-button {
          height: 43px;
          border: 1px solid #494c46;
          border-radius: 8px;
          background: #292c28;
          color: #ddd9cf;
          padding: 0 14px;
        }

        .filter-button.active {
          background: #214234;
          border-color: #738a7b;
          color: #b6e1ce;
        }

        .clear-filter {
          height: 43px;
          border: 0;
          background: transparent;
          color: #aaa69c;
          text-decoration: underline;
          padding: 0 8px;
        }

        .date-summary {
          color: #89877f;
          font-family: Arial, sans-serif;
          font-size: 13px;
        }

        .expense-summary {
          margin-top: 24px;
          border: 1px solid #41443f;
          border-radius: 12px;
          background: #171b1b;
          padding: 20px;
        }

        .section-title {
          color: #aaa69c;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }

        .expense-summary-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 10px 0;
          border-bottom: 1px solid #30332e;
        }

        .expense-summary-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .expense-summary-value {
          color: #db7658;
          font-family: "Courier New", monospace;
          font-weight: 700;
          white-space: nowrap;
        }

        .expense-summary-total {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 14px;
          border-top: 2px solid #ddd9cf;
          font-weight: 700;
        }

        .expense-day {
          margin-top: 24px;
          border: 1px solid #41443f;
          border-radius: 12px;
          background: #171b1b;
          padding: 20px;
        }

        .expense-day-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 12px 0;
          border-bottom: 1px solid #30332e;
        }

        .expense-day-name {
          font-size: 16px;
          font-weight: 700;
        }

        .expense-day-detail {
          color: #89877f;
          font-family: Arial, sans-serif;
          font-size: 12px;
          margin-top: 5px;
        }

        .expense-day-right {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }

        .expense-day-amount {
          color: #db7658;
          font-family: "Courier New", monospace;
          font-weight: 700;
          white-space: nowrap;
        }

        .expense-day-total {
          display: flex;
          justify-content: space-between;
          margin-top: 13px;
          padding-top: 13px;
          border-top: 2px solid #ddd9cf;
          font-weight: 700;
        }

        .draft {
          margin-top: 24px;
          border: 1px dashed #d8aa50;
          border-radius: 12px;
          background: rgba(74,55,9,.45);
          padding: 20px;
        }

        .draft-header {
          display: flex;
          justify-content: space-between;
          color: #d8aa50;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .draft-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 12px 0;
          border-bottom: 1px dashed rgba(216,170,80,.35);
        }

        .draft-detail {
          color: #aaa69c;
          font-family: Arial, sans-serif;
          font-size: 12px;
          margin-top: 4px;
        }

        .draft-right {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }

        .draft-amount {
          color: #d8aa50;
          font-family: "Courier New", monospace;
          font-weight: 700;
        }

        .draft-total {
          display: flex;
          justify-content: space-between;
          margin-top: 13px;
          padding-top: 13px;
          border-top: 2px solid #d8aa50;
          color: #d8aa50;
          font-weight: 700;
        }

        .draft-commit {
          width: 100%;
          height: 46px;
          margin-top: 15px;
          border: 0;
          border-radius: 8px;
          background: #b08532;
          color: #fff;
          font-weight: 700;
        }

        .draft-commit:hover {
          background: #c1933c;
        }

        .bottom-nav {
          position: fixed;
          z-index: 50;
          left: 0;
          right: 0;
          bottom: 0;
          height: 88px;
          border-top: 1px solid rgba(232,226,213,.35);
          background: rgba(43,38,22,.98);
          display: grid;
          grid-template-columns: repeat(5,1fr);
          backdrop-filter: blur(8px);
        }

        .nav-button {
          border: 0;
          background: transparent;
          color: #aaa69c;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 600;
        }

        .nav-button.active {
          color: #e8e2d5;
        }

        .modal-backdrop {
          position: fixed;
          z-index: 100;
          inset: 0;
          background: rgba(0,0,0,.65);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-y: auto;
        }

        .modal {
          width: min(100%, 500px);
          border: 1px solid #4a4c46;
          border-radius: 14px;
          background: #1a1d1c;
          box-shadow: 0 20px 70px rgba(0,0,0,.6);
          padding: 25px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal h2 {
          margin: 0 0 22px;
          font-size: 27px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          color: #aaa69c;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 700;
        }

        .form-input {
          width: 100%;
          height: 48px;
          border: 1px solid #494c46;
          border-radius: 8px;
          outline: none;
          background: #101313;
          color: #e8e2d5;
          padding: 0 13px;
          margin-bottom: 17px;
          font-family: Arial, sans-serif;
        }

        .form-input:focus,
        .filter-input:focus {
          border-color: #8ed1b6;
        }

        .type-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
        }

        .type-button {
          height: 46px;
          border: 1px solid #494c46;
          border-radius: 8px;
          background: #101313;
          color: #aaa69c;
        }

        .type-button.selected-income {
          border-color: #8ed1b6;
          color: #8ed1b6;
          background: #123b2b;
        }

        .type-button.selected-expense {
          border-color: #db7658;
          color: #db7658;
          background: #4a2113;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 5px;
        }

        .modal-button {
          min-height: 44px;
          padding: 0 18px;
          border-radius: 8px;
          border: 1px solid #4a4c46;
          background: #292c28;
          color: #ddd9cf;
        }

        .modal-button.primary {
          border-color: #738a7b;
          background: #214234;
          color: #b6e1ce;
        }

        .modal-button.danger {
          border-color: #8d4b3b;
          background: #4a2113;
          color: #db7658;
        }

        .money-preview {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          margin-bottom: 18px;
          border-radius: 9px;
          background: #123b2b;
        }

        .money-preview.expense {
          background: #4a2113;
        }

        .money-preview-label {
          color: #aaa69c;
          font-family: Arial, sans-serif;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .money-preview-value {
          font-family: "Courier New", monospace;
          font-size: 20px;
          font-weight: 700;
        }

        .money-preview.income .money-preview-value {
          color: #8ed1b6;
        }

        .money-preview.expense .money-preview-value {
          color: #db7658;
        }

        .quantity-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .floating-add {
          position: fixed;
          z-index: 45;
          right: 24px;
          bottom: 108px;
          width: 56px;
          height: 56px;
          border: 0;
          border-radius: 50%;
          background: #183b30;
          color: #a5d8c1;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 5px 20px rgba(0,0,0,.35);
        }

        @media (max-width:700px) {
          .topbar {
            height: 78px;
            padding: 0 15px;
          }

          .brand {
            font-size: 25px;
          }

          .content {
            width: min(100% - 20px,1100px);
            padding-top: 22px;
          }

          .page-title {
            font-size: 35px;
          }

          .subtitle {
            font-size: 18px;
            margin-bottom: 27px;
          }

          .cards {
            grid-template-columns: 1fr;
            gap: 17px;
          }

          .actions {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .bottom-nav {
            height: 82px;
          }

          .nav-button {
            font-size: 11px;
          }

          .floating-add {
            right: 15px;
            bottom: 94px;
          }

          .transaction {
            gap: 10px;
            padding: 15px 12px;
          }

          .transaction-note {
            font-size: 15px;
          }

          .transaction-amount {
            font-size: 13px;
          }

          .transaction-icon {
            width: 38px;
            height: 38px;
          }

          .transaction-actions {
            flex-direction: column;
          }

          .filter-box {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-group {
            width: 100%;
          }

          .filter-input {
            width: 100%;
          }

          .quantity-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .expense-day-row,
          .draft-row {
            align-items: flex-start;
          }

          .expense-day-right,
          .draft-right {
            flex-direction: column;
            align-items: flex-end;
          }
        }
      `}</style>

      <div className="app">
        {/* ======================================================
            HEADER
        ====================================================== */}

        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">
              <WalletIcon size={28} />
            </div>

            <span>Sổ Quỹ</span>
          </div>
        </header>

        <main className="content">
          {error && <div className="warning">⚠ {error}</div>}

          {loading ? (
            <>
              <h1 className="page-title">Tổng quan</h1>

              <p className="subtitle">Đang tải dữ liệu từ Supabase...</p>
            </>
          ) : (
            <>
              {/* =================================================
                  TỔNG QUAN
              ================================================= */}

              {activeTab === 'overview' && (
                <>
                  <h1 className="page-title">Tổng quan</h1>

                  <p className="subtitle">
                    Tình hình quỹ được cập nhật ngay khi bạn thêm, sửa hoặc xóa
                    giao dịch.
                  </p>

                  <section className="cards">
                    <div className="card income">
                      <div className="card-label">Tổng thu</div>

                      <div className="card-icon">
                        <TrendUpIcon size={27} />
                      </div>

                      <div className="card-value">{formatVND(totalIncome)}</div>
                    </div>

                    <div className="card expense">
                      <div className="card-label">Tổng chi</div>

                      <div className="card-icon">
                        <TrendDownIcon size={27} />
                      </div>

                      <div className="card-value">
                        {formatVND(totalExpense)}
                      </div>
                    </div>

                    <div className="card balance">
                      <div className="card-label">Số dư hiện tại</div>

                      <div className="card-icon">
                        <BankIcon size={26} />
                      </div>

                      <div className="card-value">{formatVND(balance)}</div>
                    </div>

                    <div className="card count">
                      <div className="card-label">Số giao dịch</div>

                      <div className="card-icon">
                        <ClipboardIcon size={26} />
                      </div>

                      <div className="card-value">{transactions.length}</div>
                    </div>
                  </section>

                  <section className="actions">
                    <button
                      className="action-button income"
                      onClick={() => openForm('income')}
                    >
                      <div className="action-button-title">
                        <PlusIcon size={21} />
                        Thêm khoản thu
                      </div>

                      <small>Ghi nhận tiền thu vào quỹ.</small>
                    </button>

                    <button
                      className="action-button expense"
                      onClick={() => openForm('expense')}
                    >
                      <div className="action-button-title">
                        <PlusIcon size={21} />
                        Thêm khoản chi
                      </div>

                      <small>Ghi nhận tiền chi ra từ quỹ.</small>
                    </button>
                  </section>
                </>
              )}

              {/* =================================================
                  THU
              ================================================= */}

              {activeTab === 'income' && (
                <>
                  <h1 className="page-title">Khoản thu</h1>

                  <p className="subtitle">Các khoản tiền đã thu vào quỹ.</p>

                  <TransactionPanel
                    transactions={filteredHistory}
                    onEdit={setEditTransaction}
                    onDelete={setDeleteTransactionId}
                  />
                </>
              )}

              {/* =================================================
                  CHI
              ================================================= */}

              {activeTab === 'expense' && (
                <>
                  <h1 className="page-title">Khoản chi</h1>

                  <p className="subtitle">Các khoản tiền đã chi từ quỹ.</p>

                  <TransactionPanel
                    transactions={filteredHistory}
                    onEdit={setEditTransaction}
                    onDelete={setDeleteTransactionId}
                  />

                  <ExpenseSummary transactions={transactions} />
                </>
              )}

              {/* =================================================
                  TỔNG KẾT
              ================================================= */}

              {activeTab === 'summary' && (
                <>
                  <h1 className="page-title">Tổng kết</h1>

                  <p className="subtitle">
                    Chọn khoảng thời gian để xem tổng thu, tổng chi và số dư
                    trong kỳ.
                  </p>

                  <div className="filter-box">
                    <div className="filter-group">
                      <label className="filter-label">Từ ngày</label>

                      <input
                        className="filter-input"
                        type="date"
                        value={fromDate}
                        onChange={(event) => setFromDate(event.target.value)}
                      />
                    </div>

                    <div className="filter-group">
                      <label className="filter-label">Đến ngày</label>

                      <input
                        className="filter-input"
                        type="date"
                        value={toDate}
                        onChange={(event) => setToDate(event.target.value)}
                      />
                    </div>

                    <div className="date-summary">
                      {fromDate ? formatDate(fromDate) : 'Tất cả'}
                      {' → '}
                      {toDate ? formatDate(toDate) : 'Tất cả'}
                    </div>

                    {(fromDate || toDate) && (
                      <button
                        className="clear-filter"
                        onClick={() => {
                          setFromDate('');
                          setToDate('');
                        }}
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </div>

                  <div className="summary-grid">
                    <div className="summary-item">
                      <div className="summary-item-label">Tổng thu</div>

                      <div
                        className="summary-item-value"
                        style={{
                          color: '#8ed1b6',
                        }}
                      >
                        {formatVND(
                          filteredHistory
                            .filter((item) => item.type === 'income')
                            .reduce((sum, item) => sum + Number(item.amount), 0)
                        )}
                      </div>
                    </div>

                    <div className="summary-item">
                      <div className="summary-item-label">Tổng chi</div>

                      <div
                        className="summary-item-value"
                        style={{
                          color: '#db7658',
                        }}
                      >
                        {formatVND(
                          filteredHistory
                            .filter((item) => item.type === 'expense')
                            .reduce((sum, item) => sum + Number(item.amount), 0)
                        )}
                      </div>
                    </div>

                    <div className="summary-item">
                      <div className="summary-item-label">Số dư</div>

                      <div
                        className="summary-item-value"
                        style={{
                          color: '#d8aa50',
                        }}
                      >
                        {formatVND(
                          filteredHistory.reduce(
                            (sum, item) =>
                              sum +
                              (item.type === 'income'
                                ? Number(item.amount)
                                : -Number(item.amount)),
                            0
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 25 }}>
                    <TransactionPanel
                      transactions={filteredHistory}
                      onEdit={setEditTransaction}
                      onDelete={setDeleteTransactionId}
                    />
                  </div>
                </>
              )}

              {/* =================================================
                  LỊCH SỬ
              ================================================= */}

              {activeTab === 'history' && (
                <>
                  <h1 className="page-title">Lịch sử giao dịch</h1>

                  <p className="subtitle">
                    Đang hiển thị {filteredHistory.length} trên{' '}
                    {transactions.length} giao dịch.
                  </p>

                  <div className="filter-box">
                    <div className="filter-group">
                      <label className="filter-label">Loại</label>

                      <div
                        style={{
                          display: 'flex',
                          gap: 7,
                        }}
                      >
                        <button
                          className="filter-button active"
                          onClick={() => {
                            setFromDate('');
                            setToDate('');
                            setActiveTab('history');
                          }}
                        >
                          Tất cả
                        </button>

                        <button
                          className="filter-button"
                          onClick={() => setActiveTab('income')}
                        >
                          Thu
                        </button>

                        <button
                          className="filter-button"
                          onClick={() => setActiveTab('expense')}
                        >
                          Chi
                        </button>
                      </div>
                    </div>

                    <div className="filter-group">
                      <label className="filter-label">Từ ngày</label>

                      <input
                        className="filter-input"
                        type="date"
                        value={fromDate}
                        onChange={(event) => setFromDate(event.target.value)}
                      />
                    </div>

                    <div className="filter-group">
                      <label className="filter-label">Đến ngày</label>

                      <input
                        className="filter-input"
                        type="date"
                        value={toDate}
                        onChange={(event) => setToDate(event.target.value)}
                      />
                    </div>

                    <button
                      className="filter-button"
                      onClick={() =>
                        setSortDirection((current) =>
                          current === 'desc' ? 'asc' : 'desc'
                        )
                      }
                    >
                      {sortDirection === 'desc'
                        ? 'Mới nhất trước'
                        : 'Cũ nhất trước'}
                    </button>

                    <button
                      className="clear-filter"
                      onClick={() => {
                        setFromDate('');
                        setToDate('');
                        setActiveTab('history');
                      }}
                    >
                      Xóa bộ lọc
                    </button>
                  </div>

                  <TransactionPanel
                    transactions={filteredHistory}
                    onEdit={setEditTransaction}
                    onDelete={setDeleteTransactionId}
                  />
                </>
              )}
            </>
          )}
        </main>

        {/* ======================================================
            NÚT +
        ====================================================== */}

        <button
          className="floating-add"
          onClick={() =>
            openForm(activeTab === 'expense' ? 'expense' : 'income')
          }
          aria-label="Thêm giao dịch"
        >
          <PlusIcon size={28} />
        </button>

        {/* ======================================================
            BOTTOM NAV
        ====================================================== */}

        <nav className="bottom-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`nav-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* ======================================================
            ADD MODAL
        ====================================================== */}

        {showForm && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowForm(false);
                setDraftItems([]);
              }
            }}
          >
            <div className="modal">
              <h2>
                {formType === 'income' ? 'Thêm khoản thu' : 'Thêm khoản chi'}
              </h2>

              <div className="type-buttons">
                <button
                  type="button"
                  className={`type-button ${
                    formType === 'income' ? 'selected-income' : ''
                  }`}
                  onClick={() => {
                    setFormType('income');
                    setDraftItems([]);
                  }}
                >
                  ↗ Khoản thu
                </button>

                <button
                  type="button"
                  className={`type-button ${
                    formType === 'expense' ? 'selected-expense' : ''
                  }`}
                  onClick={() => setFormType('expense')}
                >
                  ↘ Khoản chi
                </button>
              </div>

              {/* NGÀY */}

              <label className="form-label">
                {formType === 'income' ? 'Ngày thu' : 'Ngày chi'}
              </label>

              <input
                className="form-input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={draftItems.length > 0}
              />

              {/* TÊN KHOẢN CHI */}

              {formType === 'expense' && (
                <>
                  <label className="form-label">Tên hàng hóa / khoản chi</label>

                  {knownExpenseNames.length > 0 && (
                    <select
                      className="form-input"
                      value={nameChoice}
                      onChange={(event) => {
                        setNameChoice(event.target.value);

                        if (event.target.value !== OTHER_OPTION) {
                          setCustomName('');
                        }
                      }}
                    >
                      <option value={OTHER_OPTION}>
                        + Khác (nhập tên mới)
                      </option>

                      {knownExpenseNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}

                  {nameChoice === OTHER_OPTION && (
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Ví dụ: Giấy A4"
                      value={customName}
                      onChange={(event) => setCustomName(event.target.value)}
                    />
                  )}
                </>
              )}

              {/* SỐ LƯỢNG + ĐƠN GIÁ */}

              <div className="quantity-grid">
                <div>
                  <label className="form-label">Số lượng</label>

                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Đơn giá (VND)</label>

                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="1000"
                    placeholder="50000"
                    value={unitAmount}
                    onChange={(event) => setUnitAmount(event.target.value)}
                  />
                </div>
              </div>

              {/* GHI CHÚ */}

              <label className="form-label">Ghi chú</label>

              <input
                className="form-input"
                type="text"
                placeholder={
                  formType === 'expense'
                    ? 'Ví dụ: In tài liệu tuyển dụng'
                    : 'Không bắt buộc'
                }
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />

              {/* TOTAL */}

              <div
                className={`money-preview ${
                  formType === 'expense' ? 'expense' : 'income'
                }`}
              >
                <span className="money-preview-label">Thành tiền</span>

                <span
                  className={`money-preview-value ${
                    formType === 'expense' ? 'expense' : 'income'
                  }`}
                >
                  {formatVND(lineTotal)}
                </span>
              </div>

              {/* =================================================
                  DRAFT CHI
              ================================================= */}

              {formType === 'expense' && draftItems.length > 0 && (
                <div className="draft">
                  <div className="draft-header">
                    <span>Giỏ tạm</span>

                    <span>{draftItems.length} khoản</span>
                  </div>

                  {draftItems.map((item) => (
                    <div className="draft-row" key={item.id}>
                      <div>
                        <div>{item.name}</div>

                        <div className="draft-detail">
                          {item.quantity} × {formatVND(item.unitAmount)}
                        </div>
                      </div>

                      <div className="draft-right">
                        <span className="draft-amount">
                          {formatVND(item.totalAmount)}
                        </span>

                        <button
                          className="edit-button"
                          onClick={() => editDraftExpense(item)}
                        >
                          <PencilIcon />
                        </button>

                        <button
                          className="delete-button"
                          onClick={() => removeDraftExpense(item.id)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="draft-total">
                    <span>Tổng tạm</span>

                    <span>
                      {formatVND(
                        draftItems.reduce(
                          (sum, item) => sum + item.totalAmount,
                          0
                        )
                      )}
                    </span>
                  </div>

                  <button className="draft-commit" onClick={commitExpenses}>
                    ✓ Chi — lưu {draftItems.length} khoản vào lịch sử
                  </button>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-button"
                  onClick={() => {
                    setShowForm(false);
                    setDraftItems([]);
                  }}
                >
                  Hủy
                </button>

                {formType === 'income' ? (
                  <button
                    type="button"
                    className="modal-button primary"
                    onClick={addIncome}
                  >
                    Lưu khoản thu
                  </button>
                ) : (
                  <button
                    type="button"
                    className="modal-button primary"
                    disabled={!canAddLine}
                    style={{
                      opacity: canAddLine ? 1 : 0.4,
                    }}
                    onClick={addDraftExpense}
                  >
                    + Thêm khoản chi
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            EDIT MODAL
        ====================================================== */}

        {editTransaction && (
          <EditModal
            transaction={editTransaction}
            onClose={() => setEditTransaction(null)}
            onSave={saveEdit}
          />
        )}

        {/* ======================================================
            DELETE MODAL
        ====================================================== */}

        {deleteTransactionId && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setDeleteTransactionId(null);
              }
            }}
          >
            <div className="modal">
              <h2>Xóa giao dịch?</h2>

              <p
                style={{
                  color: '#aaa69c',
                  fontFamily: 'Arial, sans-serif',
                  lineHeight: 1.6,
                }}
              >
                Giao dịch này sẽ bị xóa vĩnh viễn khỏi Supabase. Thao tác này
                không thể hoàn tác.
              </p>

              <div className="modal-actions">
                <button
                  className="modal-button"
                  onClick={() => setDeleteTransactionId(null)}
                >
                  Hủy
                </button>

                <button className="modal-button danger" onClick={confirmDelete}>
                  Xóa giao dịch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   TRANSACTION PANEL
   ============================================================ */

function TransactionPanel({
  transactions,
  onDelete,
  onEdit,
}: {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Danh sách giao dịch</h2>
      </div>

      {transactions.length === 0 ? (
        <div className="empty">Chưa có giao dịch nào.</div>
      ) : (
        <div>
          {transactions.map((transaction) => (
            <div
              className={`transaction ${transaction.type}`}
              key={transaction.id}
            >
              <div className="transaction-icon">
                {transaction.type === 'income' ? (
                  <TrendUpIcon size={23} />
                ) : (
                  <TrendDownIcon size={23} />
                )}
              </div>

              <div className="transaction-info">
                <div className="transaction-note">
                  {getTransactionName(transaction)}
                </div>

                <div className="transaction-date">
                  {formatDate(transaction.date)}
                </div>

                <div className="transaction-detail">
                  {getQuantity(transaction)} ×{' '}
                  {formatVND(getUnitAmount(transaction))}
                  {transaction.note ? ` • ${transaction.note}` : ''}
                </div>
              </div>

              <div className="transaction-amount">
                {transaction.type === 'income' ? '+' : '−'}

                {formatVND(transaction.amount)}
              </div>

              <div className="transaction-actions">
                <button
                  className="edit-button"
                  onClick={() => onEdit(transaction)}
                  title="Sửa giao dịch"
                >
                  <PencilIcon />
                </button>

                <button
                  className="delete-button"
                  onClick={() => onDelete(transaction.id)}
                  title="Xóa giao dịch"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   EXPENSE SUMMARY
   ============================================================ */

function ExpenseSummary({ transactions }: { transactions: Transaction[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, number>();

    transactions
      .filter((item) => item.type === 'expense')
      .forEach((item) => {
        const name = getTransactionName(item);

        map.set(name, (map.get(name) || 0) + Number(item.amount));
      });

    return Array.from(map.entries())
      .map(([name, total]) => ({
        name,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  if (grouped.length === 0) {
    return null;
  }

  const total = grouped.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="expense-summary">
      <div className="section-title">Tổng hợp các khoản chi</div>

      {grouped.map((item) => (
        <div className="expense-summary-row" key={item.name}>
          <span className="expense-summary-name">{item.name}</span>

          <span className="expense-summary-value">{formatVND(item.total)}</span>
        </div>
      ))}

      <div className="expense-summary-total">
        <span>Tổng tiền các khoản đã nhập</span>

        <span
          style={{
            color: '#db7658',
            fontFamily: '"Courier New", monospace',
          }}
        >
          {formatVND(total)}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   EDIT MODAL
   ============================================================ */

function EditModal({
  transaction,
  onClose,
  onSave,
}: {
  transaction: Transaction;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
}) {
  const [form, setForm] = useState<Transaction>(transaction);

  useEffect(() => {
    setForm(transaction);
  }, [transaction]);

  const total = (Number(form.quantity) || 0) * (Number(form.unitAmount) || 0);

  function update(field: keyof Transaction, value: any) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Sửa giao dịch</h2>

        <label className="form-label">Loại</label>

        <div className="type-buttons">
          <button
            className={`type-button ${
              form.type === 'income' ? 'selected-income' : ''
            }`}
            onClick={() => update('type', 'income')}
          >
            ↗ Khoản thu
          </button>

          <button
            className={`type-button ${
              form.type === 'expense' ? 'selected-expense' : ''
            }`}
            onClick={() => update('type', 'expense')}
          >
            ↘ Khoản chi
          </button>
        </div>

        <label className="form-label">Ngày</label>

        <input
          className="form-input"
          type="date"
          value={form.date}
          onChange={(event) => update('date', event.target.value)}
        />

        {form.type === 'expense' && (
          <>
            <label className="form-label">Tên khoản chi</label>

            <input
              className="form-input"
              type="text"
              value={form.name || ''}
              onChange={(event) => update('name', event.target.value)}
            />
          </>
        )}

        <div className="quantity-grid">
          <div>
            <label className="form-label">Số lượng</label>

            <input
              className="form-input"
              type="number"
              min="1"
              value={form.quantity ?? 1}
              onChange={(event) =>
                update('quantity', Number(event.target.value))
              }
            />
          </div>

          <div>
            <label className="form-label">Đơn giá</label>

            <input
              className="form-input"
              type="number"
              min="1"
              value={form.unitAmount ?? form.amount}
              onChange={(event) =>
                update('unitAmount', Number(event.target.value))
              }
            />
          </div>
        </div>

        <label className="form-label">Ghi chú</label>

        <input
          className="form-input"
          type="text"
          value={form.note || ''}
          onChange={(event) => update('note', event.target.value)}
        />

        <div
          className={`money-preview ${
            form.type === 'expense' ? 'expense' : 'income'
          }`}
        >
          <span className="money-preview-label">Thành tiền</span>

          <span className="money-preview-value">{formatVND(total)}</span>
        </div>

        <div className="modal-actions">
          <button className="modal-button" onClick={onClose}>
            Hủy
          </button>

          <button
            className="modal-button primary"
            onClick={() =>
              onSave({
                ...form,
                amount: total || Number(form.amount),
              })
            }
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
