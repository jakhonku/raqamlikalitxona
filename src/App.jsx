import React, { useState, useEffect, useRef } from 'react';
import { 
  ConfigProvider, Layout, Menu, Input, Table, Tag, Button, 
  Modal, Spin, Card, Row, Col, Statistic, Select, InputNumber, 
  message, Empty, theme, Alert
} from 'antd';
import { 
  SearchOutlined, BarChartOutlined, KeyOutlined, 
  DashboardOutlined, TeamOutlined, ReloadOutlined, CameraOutlined 
} from '@ant-design/icons';
import { Html5Qrcode } from 'html5-qrcode';
import './index.css';

const { Header, Content } = Layout;
const GAS_URL = "https://script.google.com/macros/s/AKfycbzQK4Gp0Dfo4WAqmRIma7vjEM8ARGGHiGvotHndMmcKMebX_CAaXtg1_tOpWFpYxARHqQ/exec";

function App() {
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [occupant, setOccupant] = useState(null);
  const [role, setRole] = useState('teacher');
  const [duration, setDuration] = useState(2);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [view, setView] = useState('list');
  const [analytics, setAnalytics] = useState([]);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (showMainLoader = false) => {
    if (showMainLoader) setLoading(true);
    try {
      const res = await fetch(`${GAS_URL}?action=getAll`);
      if (!res.ok) throw new Error("Network error");
      const result = JSON.parse(await res.text());
      if (result.success) {
        setRooms(result.data.rooms || []);
        setUsers(result.data.users || []);
        setAnalytics(result.data.analytics || []);
      }
    } catch (e) {
      console.error("Ma'lumotlarni yuklashda xatolik:", e);
      message.error("Ma'lumotlarni Google Sheet'dan olib bo'lmadi. Iltimos, ulanishni tekshiring.");
      setRooms([]);
      setUsers([]);
      setAnalytics([]);
    }
    if (showMainLoader) setLoading(false);
  };

  const filteredRooms = rooms.filter(
    (room) =>
      String(room.id).toLowerCase().includes(search) ||
      (room.occupant && String(room.occupant).toLowerCase().includes(search))
  );

  const freeCount = rooms.filter((r) => r.status === 'free').length;
  const occupiedCount = rooms.filter((r) => r.status === 'occupied').length;

  const openModal = (roomId) => {
    setSelectedRoom(roomId);
    setOccupant(null);
    setRole('teacher');
    setDuration(2);
    setQrOpen(false);
    setModalOpen(true);
  };

  const closeBtn = () => {
    setModalOpen(false);
    setQrOpen(false);
  };

  const handleQRScan = (scannedId) => {
    const sId = String(scannedId).trim();
    const foundUser = users.find(u => u.id === sId || u.name.toLowerCase().includes(sId.toLowerCase()));
    if (foundUser) {
      handleUserSelect(foundUser.name);
      setQrOpen(false);
      message.success(`${foundUser.name} tanlandi`);
    } else {
      message.error("Topilmadi: " + sId);
    }
  };

  const handleUserSelect = (value) => {
    setOccupant(value);
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('talaba')) {
      setRole('student');
    } else if (lowerValue.includes('hodim')) {
      setRole('staff');
    } else {
      setRole('teacher');
    }
  };

  const confirmIssue = async () => {
    if (!occupant) {
      message.warning("Iltimos, xodim yoki talabani tanlang!");
      return;
    }
    if (role === 'student' && !duration) {
      message.warning("Iltimos, muddatni kiriting!");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        action: 'checkOut',
        roomId: selectedRoom,
        occupantName: occupant,
        role: role,
        duration: duration,
      };

      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        message.success(data.message);
        fetchData();
        closeBtn();
      } else {
        message.error(data.message || "Xatolik yuz berdi");
      }
    } catch (e) {
      message.error("Tasdiqlashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
    } finally {
      setActionLoading(false);
    }
  };

  const receiveKey = async (roomId) => {
    Modal.confirm({
      title: "Kalitni qabul qilish",
      content: `Haqiqatan ham ${roomId}-xona kaliti qaytarilmoqdami?`,
      okText: 'Ha, qaytarildi',
      cancelText: 'Bekor qilish',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'checkIn', roomId })
          });
          const data = await res.json();
          if (data.success) {
            fetchData();
            message.success(data.message);
          }
        } catch (e) {
          message.error("Ma'lumotni Google Sheet'ga yuborishda xatolik!");
        }
      }
    });
  };

  const columns = [
    {
      title: 'Xona',
      dataIndex: 'id',
      key: 'id',
      width: '12%',
      render: (text) => <strong style={{ fontSize: 16 }}>{text}</strong>,
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      key: 'status',
      width: '15%',
      render: (status) => (
        <Tag color={status === 'free' ? 'success' : 'error'} className="status-tag">
          {status === 'free' ? "BO'SH" : 'BAND'}
        </Tag>
      ),
    },
    {
      title: "Mas'ul shaxs",
      dataIndex: 'occupant',
      key: 'occupant',
      render: (occupant) => occupant ? <span style={{ fontWeight: 500 }}>{occupant}</span> : <span style={{ color: '#aaa', fontStyle: 'italic' }}>-</span>,
    },
    {
      title: 'Vaqti / Muddati',
      dataIndex: 'time',
      key: 'time',
      width: '20%',
      render: (time, record) => {
        if (record.status === 'free') return <span style={{ color: '#aaa' }}>-</span>;
        
        let overdueEl = null;
        if (record.duration) {
          const durMatch = String(record.duration).match(/(\d+)/);
          if (durMatch && time) {
            const durHours = parseInt(durMatch[1], 10);
            const parts = String(time).split(':');
            if (parts.length >= 2) {
              const now = new Date();
              let issueTime = new Date();
              issueTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
              if (issueTime > now) issueTime.setDate(issueTime.getDate() - 1);
              
              const dueTime = new Date(issueTime.getTime() + durHours * 60 * 60 * 1000);
              if (now > dueTime) {
                const diffMins = Math.floor((now - dueTime) / 60000);
                overdueEl = <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: 4 }}>⚠️ {Math.floor(diffMins / 60)}s {diffMins % 60}m kech!</div>;
              } else {
                overdueEl = <div style={{ color: '#64748b', fontSize: '12px', marginTop: 2 }}>Muddati: {record.duration}</div>;
              }
            }
          }
        }
        
        return (
          <div style={{ lineHeight: '1.2' }}>
            <span style={{ fontSize: 13 }}>{time} da lydi</span>
            {overdueEl}
          </div>
        );
      },
    },
    {
      title: 'Amal',
      key: 'action',
      width: '15%',
      render: (_, record) => (
        record.status === 'free' ? (
          <Button type="primary" onClick={() => openModal(record.id)} style={{ borderRadius: 8 }}>
            Band qilish
          </Button>
        ) : (
          <Button danger onClick={() => receiveKey(record.id)} style={{ borderRadius: 8 }}>
            Bo'shatish
          </Button>
        )
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: "'Outfit', 'Inter', sans-serif",
          colorPrimary: '#1e40af',
          borderRadius: 12,
        },
        components: {
          Button: {
            controlHeight: 40,
            borderRadius: 8,
          },
        }
      }}
    >
      <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
        <Header className="header-glass" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="brand-title">
            <DashboardOutlined style={{ color: '#1e40af' }} />
            Raqamli Kalitxona
          </div>
          <Menu 
            mode="horizontal" 
            selectedKeys={[view]} 
            onClick={(e) => setView(e.key)}
            style={{ border: 'none', background: 'transparent', width: 250, justifyContent: 'flex-end', fontWeight: 600 }}
            items={[
              { key: 'list', icon: <KeyOutlined />, label: 'Kalitlar' },
              { key: 'analytics', icon: <BarChartOutlined />, label: 'Monitoring' },
            ]}
          />
        </Header>

        <Content className="main-container animate-fade-in">
          {view === 'list' ? (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Input 
                    size="large" 
                    placeholder="Xona yoki shaxs bo'yicha qidirish..." 
                    prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value.toLowerCase())}
                    style={{ borderRadius: 12, border: '1px solid #cbd5e1', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
                  />
                </Col>
                <Col xs={24} md={12} style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                  <Card size="small" className="stat-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                    <Statistic title="Bo'sh Xonalar" value={freeCount} valueStyle={{ color: '#059669', fontWeight: 800 }} prefix={<div className="dot free" style={{ display: 'inline-block', marginRight: 5 }}/>} />
                  </Card>
                  <Card size="small" className="stat-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                    <Statistic title="Band Xonalar" value={occupiedCount} valueStyle={{ color: '#dc2626', fontWeight: 800 }} prefix={<div className="dot occupied" style={{ display: 'inline-block', marginRight: 5 }}/>} />
                  </Card>
                  <Button size="large" icon={<ReloadOutlined />} onClick={() => fetchData(true)} style={{ alignSelf: 'center', height: '100%' }} />
                </Col>
              </Row>

              <div className="glass-card table-glass" style={{ padding: 1, overflow: 'hidden' }}>
                <Table 
                  columns={columns} 
                  dataSource={filteredRooms} 
                  rowKey={(record, index) => `${record.id}-${index}`}
                  loading={loading}
                  pagination={false}
                  rowClassName={(record) => record.status === 'occupied' ? 'row-occupied' : ''}
                />
              </div>
            </>
          ) : (
            <AnalyticsDashboard analytics={analytics} />
          )}
        </Content>

        <Modal
          title={`Xonani band qilish - ${selectedRoom}`}
          open={modalOpen}
          onCancel={closeBtn}
          footer={null}
          destroyOnClose
          width={450}
        >
          <div style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontWeight: 600 }}>Mas'ul shaxs (Xodim/Talaba)</label>
                <Button type="link" size="small" icon={<CameraOutlined />} onClick={() => setQrOpen(!qrOpen)}>QR Skaner</Button>
              </div>
              
              {!qrOpen ? (
                <Select
                  showSearch
                  size="large"
                  style={{ width: '100%' }}
                  placeholder="Shaxsni qidirish..."
                  value={occupant}
                  onChange={handleUserSelect}
                  options={Array.from(new Set(users.map(u => u.name))).map((name, i) => ({ key: `user-${i}`, label: name, value: name }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              ) : (
                <div className="qr-scanner-container">
                  <QRScanner onScan={handleQRScan} />
                </div>
              )}
            </div>

            {role === 'student' && (
              <div style={{ marginBottom: 24, animation: 'fadeIn 0.3s ease-in' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Buxgalteriya/Kalit olish muddati (Soat)</label>
                <InputNumber 
                  min={1} 
                  max={24} 
                  size="large"
                  value={duration} 
                  onChange={setDuration} 
                  style={{ width: '100%' }} 
                />
              </div>
            )}

            <Button 
              type="primary" 
              size="large" 
              block 
              loading={actionLoading} 
              onClick={confirmIssue}
              style={{ marginTop: 15 }}
            >
              Tasdiqlash
            </Button>
          </div>
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}

function QRScanner({ onScan }) {
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 20, qrbox: { width: 220, height: 220 } },
          (decoded) => { html5QrCode.stop().then(() => onScan(decoded)).catch(()=>{}); },
          undefined
        );
      } catch (err) {
        html5QrCode.start(
          { facingMode: "user" },
          { fps: 20, qrbox: { width: 220, height: 220 } },
          (decoded) => { html5QrCode.stop().then(() => onScan(decoded)).catch(()=>{}); },
          undefined
        ).catch(e => console.error("Scanner failed", e));
      }
    };
    startScanner();
    return () => { if (html5QrCode.isScanning) { html5QrCode.stop().catch(()=>{}); } };
  }, [onScan]);
  return <div id="reader" style={{ width: '100%' }}></div>;
}

function AnalyticsDashboard({ analytics }) {
  const roomUsage = (analytics?.roomUsage || []).sort((a, b) => b.count - a.count);
  const totalUsage = roomUsage.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="animate-fade-in">
      <Row gutter={[20, 20]}>
        <Col xs={24} md={8}>
          <Card className="glass-card stat-card" style={{ borderLeft: '4px solid #1e40af' }}>
            <Statistic title={<span style={{ fontWeight: 600 }}>Umumiy Kalit Olinishi</span>} value={totalUsage} suffix="marta" />
          </Card>
        </Col>
        {(analytics?.categoryUsage || []).map((cat, idx) => (
          <Col xs={12} md={8} key={idx}>
            <Card className="glass-card stat-card">
              <Statistic title={cat.name} value={cat.count} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} md={12}>
          <Card className="glass-card" title="Eng faol xonalar (Top 5)">
            {roomUsage.slice(0, 5).map(item => (
              <div key={item.id} style={{ marginBottom: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Xona {item.id}</span>
                  <strong>{item.count}</strong>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(item.count / (roomUsage[0]?.count || 1)) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="glass-card" title="Eng ko'p kalit olganlar (Top 5)">
            {(analytics?.userUsage || []).sort((a, b) => b.count - a.count).slice(0, 5).map((user, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '12px', background: '#f8fafc', borderRadius: 12, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, background: '#1e40af', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{idx + 1}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>{user.name}</div>
                <div style={{ color: '#64748b' }}>{user.count} marta</div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default App;

