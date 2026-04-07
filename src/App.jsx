import React, { useState, useEffect } from 'react';
import { 
  ConfigProvider, Layout, Menu, Input, Table, Tag, Button, 
  Modal, Card, Row, Col, Statistic, Select, InputNumber, 
  message, theme 
} from 'antd';
import { 
  SearchOutlined, BarChartOutlined, KeyOutlined, 
  DashboardOutlined, ReloadOutlined, CameraOutlined 
} from '@ant-design/icons';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from './supabaseClient';
import './index.css';

const { Header, Content } = Layout;

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
  const [analytics, setAnalytics] = useState({ roomUsage: [], userUsage: [], categoryUsage: [] });

  useEffect(() => {
    fetchInitialData();
    
    // REAL-TIME: Rooms o'zgarishini kuzatish
    const roomsSubscription = supabase
      .channel('rooms-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, payload => {
        console.log('Real-time update:', payload);
        fetchRooms(); // Yangilangan ma'lumotni qayta o'qish
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomsSubscription);
    };
  }, []);

  useEffect(() => {
    if (view === 'analytics') {
      fetchAnalytics();
    }
  }, [view]);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchRooms(), fetchUsers()]);
    setLoading(false);
  };

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('Error fetching rooms:', error);
    } else {
      setRooms(data);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers(data || []);
    }
  };

  const fetchAnalytics = async () => {
    const { data: logs, error } = await supabase
      .from('logs')
      .select('*')
      .eq('action', 'Olingan')
      .order('created_at', { ascending: false });

    if (error) return;

    let roomUsage = {};
    let userUsage = {};
    let categoryUsage = { "O'qituvchi": 0, "Talaba": 0, "Hodim": 0 };

    logs.forEach(log => {
      roomUsage[log.room_id] = (roomUsage[log.room_id] || 0) + 1;
      userUsage[log.occupant] = (userUsage[log.occupant] || 0) + 1;
      
      if (log.occupant.includes('(O\'qituvchi)')) categoryUsage["O'qituvchi"]++;
      else if (log.occupant.includes('(Talaba)')) categoryUsage["Talaba"]++;
      else if (log.occupant.includes('(Hodim)')) categoryUsage["Hodim"]++;
    });

    setAnalytics({
      roomUsage: Object.keys(roomUsage).map(id => ({ id, count: roomUsage[id] })),
      userUsage: Object.keys(userUsage).map(name => ({ name, count: userUsage[name] })),
      categoryUsage: Object.keys(categoryUsage).map(name => ({ name, count: categoryUsage[name] }))
    });
  };

  const filteredRooms = rooms.filter(
    (room) =>
      String(room.id).toLowerCase().includes(search) ||
      (room.occupant && String(room.occupant).toLowerCase().includes(search))
  );

  const openModal = (roomId) => {
    setSelectedRoom(roomId);
    setOccupant(null);
    setRole('teacher');
    setDuration(2);
    setQrOpen(false);
    setModalOpen(true);
  };

  const handleQRScan = (scannedId) => {
    const sId = String(scannedId).trim();
    const foundUser = users.find(u => u.id === sId || u.name.toLowerCase().includes(sId.toLowerCase()));
    if (foundUser) {
      handleUserSelect(foundUser.name + (foundUser.role === 'student' ? ' (Talaba)' : foundUser.role === 'staff' ? ' (Hodim)' : ' (Oqituvchi)'));
      setQrOpen(false);
      message.success(`${foundUser.name} tanlandi`);
    } else {
      message.error("Foydalanuvchi topilmadi: " + sId);
    }
  };

  const handleUserSelect = (value) => {
    setOccupant(value);
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('talaba')) setRole('student');
    else if (lowerValue.includes('hodim')) setRole('staff');
    else setRole('teacher');
  };

  const confirmIssue = async () => {
    if (!occupant) {
      message.warning("Iltimos, shaxsni tanlang!");
      return;
    }
    setActionLoading(true);
    const now = new Date();
    const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');

    try {
      // 1. Yangilash
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ 
          status: 'occupied', 
          occupant: occupant, 
          time: timeStr, 
          duration: role === 'student' ? (duration + ' soat') : null 
        })
        .eq('id', selectedRoom);

      if (updateError) throw updateError;

      // 2. Log yozish
      await supabase.from('logs').insert([{
        room_id: selectedRoom,
        occupant: occupant,
        action: 'Olingan',
        note: role === 'student' ? (duration + ' soat') : ''
      }]);

      message.success("Kalit berildi!");
      setModalOpen(false);
    } catch (e) {
      message.error("Xatolik yuz berdi: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const receiveKey = async (roomId, currentOccupant) => {
    Modal.confirm({
      title: "Kalitni qabul qilish",
      content: `${roomId}-xona kaliti qaytarilmoqdami?`,
      okText: 'Ha, qaytarildi',
      cancelText: 'Bekor qilish',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('rooms')
            .update({ status: 'free', occupant: null, time: null, duration: null })
            .eq('id', roomId);

          if (error) throw error;

          await supabase.from('logs').insert([{
            room_id: roomId,
            occupant: currentOccupant,
            action: 'Qaytarildi'
          }]);

          message.success("Kalit qabul qilindi!");
        } catch (e) {
          message.error("Xatolik: " + e.message);
        }
      }
    });
  };

  const columns = [
    { title: 'Xona', dataIndex: 'id', key: 'id', width: '12%', render: (text) => <strong style={{ fontSize: 16 }}>{text}</strong> },
    { 
      title: 'Holati', 
      dataIndex: 'status', 
      key: 'status', 
      width: '15%', 
      render: (status) => (
        <Tag color={status === 'free' ? 'success' : 'error'} className="status-tag">
          {status === 'free' ? "BO'SH" : 'BAND'}
        </Tag>
      )
    },
    { title: "Mas'ul shaxs", dataIndex: 'occupant', key: 'occupant', render: (occ) => occ || <span style={{ color: '#aaa' }}>-</span> },
    { 
      title: 'Vaqti / Muddati', 
      dataIndex: 'time', 
      key: 'time', 
      width: '20%', 
      render: (time, record) => record.status === 'occupied' ? (<div>{time} da olindi {record.duration && <div style={{ fontSize: 12, color: '#666' }}>Muddati: {record.duration}</div>}</div>) : '-' 
    },
    { 
      title: 'Amal', 
      key: 'action', 
      width: '15%', 
      render: (_, record) => record.status === 'free' ? (
        <Button type="primary" onClick={() => openModal(record.id)}>Band qilish</Button>
      ) : (
        <Button danger onClick={() => receiveKey(record.id, record.occupant)}>Bo'shatish</Button>
      )
    }
  ];

  return (
    <ConfigProvider theme={{ token: { fontFamily: "'Outfit', sans-serif", colorPrimary: '#1e40af', borderRadius: 12 } }}>
      <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header className="header-glass" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="brand-title"><DashboardOutlined /> Raqamli Kalitxona</div>
          <Menu 
            mode="horizontal" 
            selectedKeys={[view]} 
            onClick={(e) => setView(e.key)}
            style={{ border: 'none', background: 'transparent' }}
            items={[{ key: 'list', icon: <KeyOutlined />, label: 'Kalitlar' }, { key: 'analytics', icon: <BarChartOutlined />, label: 'Statistika' }]}
          />
        </Header>

        <Content className="main-container animate-fade-in">
          {view === 'list' ? (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Input size="large" placeholder="Qidirish..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value.toLowerCase())} />
                </Col>
                <Col xs={24} md={12} style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                  <Button size="large" icon={<ReloadOutlined />} onClick={fetchInitialData} loading={loading} />
                </Col>
              </Row>
              <div className="glass-card table-glass">
                <Table columns={columns} dataSource={filteredRooms} rowKey="id" loading={loading} pagination={false} />
              </div>
            </>
          ) : (
            <AnalyticsDashboard analytics={analytics} />
          )}
        </Content>

        <Modal title={`Xona ${selectedRoom}`} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
          <div style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label>Shaxsni tanlang</label>
                <Button type="link" icon={<CameraOutlined />} onClick={() => setQrOpen(!qrOpen)}>QR Skaner</Button>
              </div>
              {!qrOpen ? (
                <Select
                  showSearch
                  size="large"
                  style={{ width: '100%' }}
                  placeholder="Ismni kiriting..."
                  value={occupant}
                  onChange={handleUserSelect}
                  options={users.map(u => ({ label: `${u.name} (${u.role === 'teacher' ? 'Oqituvchi' : u.role === 'student' ? 'Talaba' : 'Hodim'})`, value: `${u.name} (${u.role === 'teacher' ? 'Oqituvchi' : u.role === 'student' ? 'Talaba' : 'Hodim'})` }))}
                />
              ) : (
                <div className="qr-scanner-container"><QRScanner onScan={handleQRScan} /></div>
              )}
            </div>
            {role === 'student' && (
              <div style={{ marginBottom: 20 }}>
                <label>Muddati (Soat)</label>
                <InputNumber min={1} max={24} size="large" value={duration} onChange={setDuration} style={{ width: '100%' }} />
              </div>
            )}
            <Button type="primary" size="large" block loading={actionLoading} onClick={confirmIssue}>Tasdiqlash</Button>
          </div>
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}

function QRScanner({ onScan }) {
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, decoded => { onScan(decoded); html5QrCode.stop(); });
    return () => { if (html5QrCode.isScanning) html5QrCode.stop(); };
  }, []);
  return <div id="reader" style={{ width: '100%' }}></div>;
}

function AnalyticsDashboard({ analytics }) {
  return (
    <div className="animate-fade-in">
      <Row gutter={[20, 20]}>
        {analytics.categoryUsage.map((cat, idx) => (
          <Col xs={12} md={8} key={idx}>
            <Card className="glass-card stat-card"><Statistic title={cat.name} value={cat.count} /></Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} md={12}>
          <Card className="glass-card" title="Eng faol xonalar">
             {analytics.roomUsage.map(item => (
                <div key={item.id} style={{ marginBottom: 10 }}>Xona {item.id}: <strong>{item.count} marta</strong></div>
             ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
           <Card className="glass-card" title="Eng faol shaxslar">
             {analytics.userUsage.slice(0, 5).map((user, i) => (
                <div key={i} style={{ marginBottom: 10 }}>{user.name}: <strong>{user.count} marta</strong></div>
             ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default App;
