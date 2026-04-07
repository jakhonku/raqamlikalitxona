import React, { useState, useEffect } from 'react';
import { 
  ConfigProvider, Layout, Menu, Input, Table, Tag, Button, 
  Modal, Card, Row, Col, Statistic, Select, InputNumber, 
  message, Popconfirm, Divider, Progress, Empty
} from 'antd';
import { 
  SearchOutlined, BarChartOutlined, KeyOutlined, 
  DashboardOutlined, ReloadOutlined, CameraOutlined, 
  UserAddOutlined, TeamOutlined, DeleteOutlined,
  CalendarOutlined, TrophyOutlined
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
  const [analytics, setAnalytics] = useState({ roomUsage: [], userUsage: [], categoryUsage: [], totalLogs: 0 });

  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('teacher');

  useEffect(() => {
    fetchInitialData();
    const roomsSub = supabase.channel('rooms').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchRooms()).subscribe();
    const usersSub = supabase.channel('users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchUsers()).subscribe();
    const logsSub = supabase.channel('logs').on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => {
      if (view === 'analytics') fetchAnalytics();
    }).subscribe();

    return () => {
      supabase.removeChannel(roomsSub);
      supabase.removeChannel(usersSub);
      supabase.removeChannel(logsSub);
    };
  }, [view]);

  useEffect(() => {
    if (view === 'analytics') fetchAnalytics();
  }, [view]);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchRooms(), fetchUsers()]);
    setLoading(false);
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('id', { ascending: true });
    if (data) setRooms(data);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('name', { ascending: true });
    if (data) setUsers(data);
  };

  const fetchAnalytics = async () => {
    // Sizning bazangizdagi ustun nomlariga mosladik: room_id, occupant_name, action, duration
    const { data: logs } = await supabase.from('logs').select('*').eq('action', 'Olingan');
    if (!logs || logs.length === 0) {
      setAnalytics({ roomUsage: [], userUsage: [], categoryUsage: [], totalLogs: 0 });
      return;
    }

    let roomUsage = {}, userUsage = {}, categoryUsage = { "O'qituvchi": 0, "Talaba": 0, "Hodim": 0 };
    logs.forEach(log => {
      const rId = log.room_id || 'Xona?';
      const oName = log.occupant_name || 'Noma\'lum';
      roomUsage[rId] = (roomUsage[rId] || 0) + 1;
      userUsage[oName] = (userUsage[oName] || 0) + 1;
      
      if (oName.includes("(O'qituvchi)")) categoryUsage["O'qituvchi"]++;
      else if (oName.includes("(Talaba)")) categoryUsage["Talaba"]++;
      else if (oName.includes("(Hodim)")) categoryUsage["Hodim"]++;
    });

    setAnalytics({
      totalLogs: logs.length,
      roomUsage: Object.keys(roomUsage).map(id => ({ id, count: roomUsage[id] })).sort((a,b) => b.count - a.count),
      userUsage: Object.keys(userUsage).map(name => ({ name, count: userUsage[name] })).sort((a,b) => b.count - a.count),
      categoryUsage: Object.keys(categoryUsage).map(name => ({ name, count: categoryUsage[name] }))
    });
  };

  const addUser = async () => {
    if (!newUserName.trim()) return message.warning("Ismni kiriting!");
    setLoading(true);
    try {
      let maxNum = 1000;
      users.forEach(u => {
        if (u.id.startsWith('RK-')) {
          const num = parseInt(u.id.split('-')[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const nextId = `RK-${maxNum + 1}`;
      const { error } = await supabase.from('users').insert([{ id: nextId, name: newUserName.trim(), role: newUserRole }]);
      if (error) throw error;
      message.success("Foydalanuvchi qo'shildi!");
      setNewUserName('');
    } catch (e) {
      message.error("Xatolik: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) message.success("O'chirildi");
  };

  const confirmIssue = async () => {
    if (!occupant) return message.warning("Shaxsni tanlang!");
    setActionLoading(true);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    try {
      // 1. Xonalar jadvali
      const { error: updateError } = await supabase.from('rooms').update({ 
        status: 'occupied', occupant, time: timeStr, duration: role === 'student' ? `${duration} soat` : null 
      }).eq('id', selectedRoom);
      if (updateError) throw updateError;
      
      // 2. Tarix (Logs) jadvali - Sizning ustun nomlaringizga moslab: room_id, occupant_name, action, duration
      const { error: logError } = await supabase.from('logs').insert([{ 
        room_id: String(selectedRoom), 
        occupant_name: occupant, 
        action: 'Olingan', 
        duration: role === 'student' ? `${duration} soat` : '-' 
      }]);
      if (logError) console.error("Log write error:", logError);

      message.success("Kalit berildi!");
      setModalOpen(false);
    } catch (e) { message.error(e.message); } finally { setActionLoading(false); }
  };

  const receiveKey = async (roomId, currentOccupant) => {
    Modal.confirm({
      title: "Kalitni qabul qilish",
      content: `${roomId}-xona kaliti qaytarilmoqdami?`,
      onOk: async () => {
        const { error } = await supabase.from('rooms').update({ status: 'free', occupant: null, time: null, duration: null }).eq('id', roomId);
        if (!error) {
          // Qaytarilgandagi tarix
          await supabase.from('logs').insert([{ 
            room_id: String(roomId), 
            occupant_name: currentOccupant, 
            action: 'Qaytarildi',
            duration: '-' 
          }]);
          message.success("Kalit qabul qilindi!");
        }
      }
    });
  };

  return (
    <ConfigProvider theme={{ token: { fontFamily: "'Outfit', sans-serif", colorPrimary: '#1e40af', borderRadius: 12 } }}>
      <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header className="header-glass" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="brand-title"><DashboardOutlined /> Raqamli Kalitxona</div>
          <Menu 
            mode="horizontal" selectedKeys={[view]} onClick={(e) => setView(e.key)} style={{ border: 'none', background: 'transparent' }}
            items={[
              { key: 'list', icon: <KeyOutlined />, label: 'Kalitlar' },
              { key: 'users', icon: <TeamOutlined />, label: 'Foydalanuvchilar' },
              { key: 'analytics', icon: <BarChartOutlined />, label: 'Statistika' }
            ]}
          />
        </Header>

        <Content className="main-container animate-fade-in">
          {view === 'list' && (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}><Input size="large" placeholder="Qidirish..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value.toLowerCase())} /></Col>
                <Col xs={24} md={12} style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}><Button size="large" icon={<ReloadOutlined />} onClick={fetchInitialData} loading={loading} /></Col>
              </Row>
              <div className="glass-card table-glass"><Table columns={[
                { title: 'Xona', dataIndex: 'id', key: 'id', width: '12%', render: (t) => <strong>{t}</strong> },
                { title: 'Holati', dataIndex: 'status', render: (s) => <Tag color={s==='free'?'success':'error'}>{s==='free'?"BO'SH":"BAND"}</Tag> },
                { title: "Mas'ul", dataIndex: 'occupant', render: (o) => o || "-" },
                { title: 'Vaqt', dataIndex: 'time', render: (t, r) => r.status==='occupied' ? `${t} da olindi` : "-" },
                { title: 'Amal', render: (_, r) => r.status==='free' ? <Button type="primary" onClick={() => { setSelectedRoom(r.id); setModalOpen(true); }}>Band qilish</Button> : <Button danger onClick={() => receiveKey(r.id, r.occupant)}>Bo'shatish</Button> }
              ]} dataSource={rooms.filter(r => String(r.id).includes(search) || (r.occupant && r.occupant.toLowerCase().includes(search)))} rowKey="id" pagination={false} /></div>
            </>
          )}

          {view === 'users' && (
            <Card className="glass-card" title={<span><UserAddOutlined /> Foydalanuvchi qo'shish</span>}>
              <Row gutter={16}>
                <Col xs={24} md={10}><Input placeholder="F.I.SH" size="large" value={newUserName} onChange={e => setNewUserName(e.target.value)} /></Col>
                <Col xs={24} md={8}><Select size="large" style={{ width: '100%' }} value={newUserRole} onChange={setNewUserRole} options={[{label:'O\'qituvchi',value:'teacher'},{label:'Talaba',value:'student'},{label:'Hodim',value:'staff'}]} /></Col>
                <Col xs={24} md={6}><Button type="primary" size="large" block onClick={addUser} icon={<UserAddOutlined />}>Qo'shish</Button></Col>
              </Row>
              <Divider />
              <Table dataSource={users} rowKey="id" columns={[
                { title: 'ID', dataIndex: 'id' },
                { title: 'Ism-sharif', dataIndex: 'name' },
                { title: 'Lavozimi', dataIndex: 'role', render: (r) => <Tag color="blue">{r==='teacher'?'O\'qituvchi':r==='student'?'Talaba':'Hodim'}</Tag> },
                { title: 'Oʻchirish', render: (_, r) => <Popconfirm title="Oʻchirilsinmi?" onConfirm={() => deleteUser(r.id)}><Button danger icon={<DeleteOutlined />} /></Popconfirm> }
              ]} />
            </Card>
          )}

          {view === 'analytics' && <AnalyticsDashboard analytics={analytics} />}
        </Content>

        <Modal title={`Xona ${selectedRoom}`} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
          <div style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><label>Tanlang</label><Button type="link" icon={<CameraOutlined />} onClick={() => setQrOpen(!qrOpen)}>QR</Button></div>
              {!qrOpen ? (
                <Select showSearch size="large" style={{ width: '100%' }} placeholder="Ismni kiriting..." value={occupant} onChange={(val) => { setOccupant(val); if(val.includes('Talaba')) setRole('student'); else if(val.includes('Hodim')) setRole('staff'); else setRole('teacher'); }}
                  options={users.map(u => ({ label: `${u.name} (${u.role==='teacher'?'O\'qituvchi':u.role==='student'?'Talaba':'Hodim'})`, value: `${u.name} (${u.role==='teacher'?'O\'qituvchi':u.role==='student'?'Talaba':'Hodim'})` }))}
                />
              ) : <div className="qr-scanner-container"><QRScanner onScan={(id) => {
                const found = users.find(u => u.id === id);
                if (found) { setOccupant(`${found.name} (${found.role==='teacher'?'O\'qituvchi':found.role==='student'?'Talaba':'Hodim'})`); setRole(found.role); setQrOpen(false); } else message.error("Topilmadi");
              }} /></div>}
            </div>
            {role === 'student' && <div style={{ marginBottom: 20 }}><label>Muddati (Soat)</label><InputNumber min={1} max={24} size="large" value={duration} onChange={setDuration} style={{ width: '100%' }} /></div>}
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
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, d => { onScan(d); html5QrCode.stop(); }).catch(() => {});
    return () => { if (html5QrCode.isScanning) html5QrCode.stop(); };
  }, []);
  return <div id="reader" style={{ width: '100%' }}></div>;
}

function AnalyticsDashboard({ analytics }) {
  const { totalLogs, roomUsage, userUsage, categoryUsage } = analytics;
  
  return (
    <div className="animate-fade-in">
      <Row gutter={[20, 20]}>
        <Col xs={24} md={6}>
          <Card className="glass-card stat-card" style={{ borderLeft: '4px solid #1e40af' }}>
            <Statistic title="Umumiy kalit olinishi" value={totalLogs} suffix="marta" />
          </Card>
        </Col>
        {(categoryUsage || []).map((cat, i) => (
          <Col xs={12} md={6} key={i}>
            <Card className="glass-card stat-card">
              <Statistic title={cat.name} value={cat.count} />
              <Progress percent={totalLogs > 0 ? (cat.count / totalLogs) * 100 : 0} showInfo={false} size="small" strokeColor="#1e40af" />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card className="glass-card" title={<span><KeyOutlined /> Eng faol xonalar (Top 5)</span>} extra={<TrophyOutlined style={{color:'#eab308'}} />}>
            {roomUsage.length > 0 ? roomUsage.slice(0, 5).map((item, i) => (
              <div key={item.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Xona {item.id}</span>
                  <strong>{item.count} marta</strong>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(item.count / (roomUsage[0]?.count || 1)) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: 4, transition: 'width 0.5s ease-out' }} />
                </div>
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card className="glass-card" title={<span><TeamOutlined /> Eng faol shaxslar (Top 5)</span>}>
            {userUsage.length > 0 ? userUsage.slice(0, 5).map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 12, marginBottom: 10, border: '1px solid #f1f5f9' }}>
                <div style={{ width: 28, height: 28, background: i === 0 ? '#1e40af' : '#64748b', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 13 }}>{i + 1}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>{u.name}</div>
                <Tag color="blue">{u.count} marta</Tag>
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default App;
