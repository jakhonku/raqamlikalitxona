import React, { useState, useEffect } from 'react';
import {
  ConfigProvider, Layout, Menu, Input, Table, Tag, Button,
  Modal, Card, Row, Col, Statistic, Select, InputNumber, Radio,
  message, Popconfirm, Divider, Progress, Empty, Upload, Result, Collapse, Badge, Space
} from 'antd';
import {
  SearchOutlined, BarChartOutlined, KeyOutlined,
  DashboardOutlined, ReloadOutlined, CameraOutlined,
  UserAddOutlined, TeamOutlined, DeleteOutlined,
  CalendarOutlined, TrophyOutlined, PlusOutlined, ApartmentOutlined,
  FileExcelOutlined, UploadOutlined, ArrowUpOutlined, ArrowDownOutlined,
  WarningOutlined, RestOutlined, HistoryOutlined, ClockCircleOutlined, LockOutlined, StopOutlined,
  ScanOutlined, InfoCircleOutlined, StarFilled, AlertOutlined, HourglassOutlined, EditOutlined, LogoutOutlined
} from '@ant-design/icons';
import { Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import './index.css';

const { Header, Content } = Layout;
const { Panel } = Collapse;

function App() {
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [occupant, setOccupant] = useState(null);
  const [role, setRole] = useState('teacher');
  const [duration, setDuration] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [view, setView] = useState('list');
  const [analytics, setAnalytics] = useState({ todayTaken: 0, todayReturned: 0, roomUsage: [], idleRooms: [] });

  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('admin_logged_in') === 'true');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [newRoomId, setNewRoomId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('teacher');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [inputPass, setInputPass] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    checkDatabaseHealth();
    fetchInitialData();
    const roomsSub = supabase.channel('rooms').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchRooms()).subscribe();
    const usersSub = supabase.channel('users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchUsers()).subscribe();
    const logsSub = supabase.channel('logs').on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => fetchAnalytics()).subscribe();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => {
      supabase.removeChannel(roomsSub);
      supabase.removeChannel(usersSub);
      supabase.removeChannel(logsSub);
      clearInterval(timer);
    };
  }, []);

  const checkDatabaseHealth = async () => {
    try {
      const { data } = await supabase.from('logs').select('created_at').order('created_at', { ascending: true }).limit(1);
      if (data && data.length > 0) {
        const diffDays = Math.floor((new Date() - new Date(data[0].created_at)) / (1000 * 60 * 60 * 24));
        if (diffDays >= 30) setIsBlocked(true);
      }
    } catch (e) { }
  };

  const clearLogs = async () => {
    setLoginLoading(true);
    const { data } = await supabase.from('admin_config').select('password').limit(1).single();
    if (data && inputPass === data.password) {
      const { error } = await supabase.from('logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (!error) {
        message.success("Tarix tozalandi!");
        setIsBlocked(false);
        setPassModalOpen(false);
        setInputPass('');
        fetchAnalytics();
      }
    } else {
      message.error("Parol noto'g'ri!");
    }
    setLoginLoading(false);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchRooms(), fetchUsers(), fetchAnalytics()]);
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
    const todayStr = new Date().toLocaleDateString('en-CA');
    const { data: allLogs } = await supabase.from('logs').select('*').order('created_at', { ascending: false });
    if (!allLogs) return;
    setLogs(allLogs);
    let metrics = { olingan: 0, qaytarilgan: 0, rooms: {}, todayUsed: new Set() };
    allLogs.forEach(l => {
      const logDate = l.created_at.split('T')[0];
      if (logDate === todayStr) {
        if (l.action === 'Olingan') { metrics.olingan++; metrics.rooms[l.room_id] = (metrics.rooms[l.room_id] || 0) + 1; metrics.todayUsed.add(l.room_id); }
        else if (l.action === 'Qaytarildi') metrics.qaytarilgan++;
      }
    });
    setAnalytics({
      todayTaken: metrics.olingan, todayReturned: metrics.qaytarilgan,
      roomUsage: Object.entries(metrics.rooms).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
      idleRooms: rooms.filter(r => !metrics.todayUsed.has(String(r.id))).map(r => r.id)
    });
  };

  const isOverdue = (roomTime, roomDuration) => {
    if (!roomTime || !roomDuration || roomDuration === '-') return false;
    const [h, m] = roomTime.split(':').map(Number);
    const durHours = parseFloat(roomDuration);
    const takeDate = new Date(); takeDate.setHours(h, m, 0, 0);
    const expireDate = new Date(takeDate.getTime() + durHours * 60 * 60 * 1000);
    return new Date() > expireDate;
  };

  const getRemainingMinutes = (roomTime, roomDuration) => {
    if (!roomTime || !roomDuration || roomDuration === '-') return 999;
    const [h, m] = roomTime.split(':').map(Number);
    const durHours = parseFloat(roomDuration);
    const takeDate = new Date(); takeDate.setHours(h, m, 0, 0);
    const expireDate = new Date(takeDate.getTime() + durHours * 60 * 60 * 1000);
    const diffMs = expireDate - new Date();
    return Math.floor(diffMs / (1000 * 60));
  };

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) return message.warning("Login va parolni kiriting!");
    setLoginLoading(true);
    const { data, error } = await supabase.from('admin_config').select('*').eq('username', loginUsername).eq('password', loginPassword).single();
    if (data && !error) {
      setIsLoggedIn(true);
      localStorage.setItem('admin_logged_in', 'true');
      message.success("Xush kelibsiz!");
    } else {
      message.error("Login yoki parol noto'g'ri!");
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('admin_logged_in');
    message.info("Tizimdan chiqdingiz.");
  };

  const addUser = async () => {
    if (!newUserName.trim()) return message.warning("Ism!");
    let max = 1000;
    users.forEach(u => { if (u.id && u.id.startsWith('RK-')) { const n = parseInt(u.id.split('-')[1]); if (!isNaN(n) && n > max) max = n; } });
    await supabase.from('users').insert([{ id: `RK-${max + 1}`, name: newUserName.trim(), role: newUserRole, password: newUserPassword.trim() }]);
    message.success("Qo'shildi!"); setNewUserName(''); setNewUserPassword(''); fetchUsers();
  };

  const addRoom = async () => {
    if (!newRoomId.trim()) return;
    await supabase.from('rooms').insert([{ id: newRoomId.trim(), status: 'free' }]);
    message.success("Qo'shildi!"); setNewRoomId(''); fetchRooms();
  };

  const deleteUser = async (id) => { await supabase.from('users').delete().eq('id', id); fetchUsers(); message.success("O'chirildi"); };
  const updateUser = async () => {
    if (!editingUser) return;
    await supabase.from('users').update({ password: editPassword }).eq('id', editingUser.id);
    message.success("Yangilandi!"); setEditModalOpen(false); fetchUsers();
  };
  const deleteRoom = async (id) => { await supabase.from('rooms').delete().eq('id', id); fetchRooms(); message.success("O'chirildi"); };

  const confirmIssue = async () => {
    if (!occupant || !selectedRoom) return;
    setActionLoading(true);
    const t = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    const durStr = (occupant.includes('(Talaba)')) ? `${duration} soat` : '-';
    await supabase.from('rooms').update({ status: 'occupied', occupant, time: t, duration: durStr }).eq('id', selectedRoom);
    await supabase.from('logs').insert([{ room_id: String(selectedRoom), occupant, action: 'Olingan', duration: durStr }]);
    message.success("Kalit berildi!"); setModalOpen(false); setActionLoading(false); fetchInitialData();
  };

  const confirmExtend = async () => {
    const room = rooms.find(r => r.id === selectedRoom);
    if (!room) return;
    const currentDur = parseFloat(room.duration);
    if (currentDur + duration > 2) return message.error("Umumiy vaqt 2 soatdan oshishi mumkin emas!");
    setActionLoading(true);
    const newDur = `${currentDur + duration} soat`;
    await supabase.from('rooms').update({ duration: newDur }).eq('id', selectedRoom);
    await supabase.from('logs').insert([{ room_id: String(selectedRoom), occupant: room.occupant, action: 'Vaqt uzaytirildi', duration: `${duration} soat qo'shildi` }]);
    message.success("Vaqt uzaytirildi!"); setExtendModalOpen(false); setActionLoading(false); fetchInitialData();
  };

  const receiveKey = async (roomId, o) => {
    Modal.confirm({
      title: "Qabul qilish?", onOk: async () => {
        await supabase.from('rooms').update({ status: 'free', occupant: null, time: null, duration: null }).eq('id', roomId);
        await supabase.from('logs').insert([{ room_id: String(roomId), occupant: o, action: 'Qaytarildi', duration: '-' }]);
        message.success("Qabul qilindi!"); fetchInitialData();
      }
    });
  };

  const handleQRScan = (id) => {
    const found = users.find(u => u.id === id);
    if (found) { setOccupant(`${found.name} (${found.role === 'teacher' ? 'O\'qituvchi' : found.role === 'student' ? 'Talaba' : 'Hodim'})`); setRole(found.role); setQrOpen(false); message.success(`${found.name} aniqlandi.`); }
    else message.error("Topilmadi!");
  };

  if (isBlocked) {
    return <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Result status="warning" title="Bazani tozalash muddati!" extra={<Button type="primary" danger onClick={() => setPassModalOpen(true)}>Tozalash (joxa0130)</Button>} /></Layout>;
  }

  if (!isLoggedIn) {
    return (
      <ConfigProvider theme={{ token: { fontFamily: "'Outfit', sans-serif", colorPrimary: '#1e40af', borderRadius: 12 } }}>
        <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
          <Card className="glass-card animate-fade-in" style={{ width: 400, textAlign: 'center', padding: '20px 10px' }}>
            <div className="brand-title" style={{ justifyContent: 'center', marginBottom: 30, fontSize: 24 }}>
              <DashboardOutlined /> Raqamli Kalitxona
            </div>
            <h3 style={{ marginBottom: 20, color: '#64748b' }}>Admin Panelga kirish</h3>
            <Input size="large" placeholder="Login" prefix={<TeamOutlined />} value={loginUsername} onChange={e => setLoginUsername(e.target.value)} style={{ marginBottom: 16 }} />
            <Input.Password size="large" placeholder="Parol" prefix={<LockOutlined />} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} style={{ marginBottom: 24 }} onPressEnter={handleLogin} />
            <Button type="primary" size="large" block loading={loginLoading} onClick={handleLogin} style={{ height: 48, fontWeight: 600 }}>Tizimga kirish</Button>
            <p style={{ marginTop: 24, fontSize: 12, color: '#94a3b8' }}>© 2026 Raqamli Kalitxona Tizimi</p>
          </Card>
        </Layout>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={{ token: { fontFamily: "'Outfit', sans-serif", colorPrimary: '#1e40af', borderRadius: 12 } }}>
      <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Header className="header-glass" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70 }}>
          <div className="brand-title"><DashboardOutlined /> Raqamli Kalitxona</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Menu mode="horizontal" selectedKeys={[view]} onClick={(e) => setView(e.key)} style={{ border: 'none', background: 'transparent', minWidth: 400 }} items={[{ key: 'list', icon: <KeyOutlined />, label: 'Kalitlar' }, { key: 'rooms_manage', icon: <ApartmentOutlined />, label: 'Xonalar' }, { key: 'users', icon: <TeamOutlined />, label: 'Foydalanuvchilar' }, { key: 'analytics', icon: <BarChartOutlined />, label: 'Statistika' }]} />
            <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>Chiqish</Button>
          </div>
        </Header>

        <Content className="main-container animate-fade-in">
          {view === 'list' && (
            <div className="glass-card table-glass">
              <Row gutter={[16, 16]} style={{ padding: 20 }}>
                <Col xs={24} md={12}><Input size="large" placeholder="Qidirish raqam yoki ism..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value.toLowerCase())} /></Col>
                <Col xs={24} md={12} style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}><Button size="large" icon={<ReloadOutlined />} onClick={fetchInitialData} loading={loading} /></Col>
              </Row>
              <Table dataSource={rooms.filter(r => String(r.id).includes(search) || (r.occupant && r.occupant.toLowerCase().includes(search)))} rowKey="id" pagination={{ pageSize: 10 }} rowClassName={(r) => r.status === 'occupied' && isOverdue(r.time, r.duration) ? 'overdue-row' : ''} columns={[
                { title: 'Xona', dataIndex: 'id', width: '10%', render: (t) => <strong>{t}</strong> },
                { title: 'Holati', dataIndex: 'status', width: '10%', render: (s) => s === 'free' ? <Tag color="success">BO'SH</Tag> : <Badge status="error" text="BAND" /> },
                { title: "Mas'ul shaxs", dataIndex: 'occupant', width: '25%' },
                {
                  title: 'Vaqt / Muddat', width: '30%', render: (_, r) => {
                    if (r.status !== 'occupied') return "-";
                    const [h, m] = r.time.split(':').map(Number);
                    const freeTime = r.duration !== '-' ? new Date(new Date().setHours(h + parseInt(r.duration), m + (parseFloat(r.duration) % 1 * 60), 0, 0)) : null;
                    const freeTimeStr = freeTime ? `${String(freeTime.getHours()).padStart(2, '0')}:${String(freeTime.getMinutes()).padStart(2, '0')}` : null;
                    return (
                      <div style={{ fontSize: 13 }}>
                        <div><ClockCircleOutlined /> <strong>{r.time}</strong> da olindi</div>
                        {r.duration !== '-' && <div style={{ marginTop: 4, color: isOverdue(r.time, r.duration) ? '#dc2626' : '#1e40af' }}><CalendarOutlined /> Topshirish: <strong>{freeTimeStr}</strong> ({r.duration}) {isOverdue(r.time, r.duration) && <Tag color="error" style={{ marginLeft: 4 }}>KECHIKDI!</Tag>}</div>}
                        {r.duration === '-' && <div style={{ marginTop: 4, color: '#64748b' }}><InfoCircleOutlined /> Cheksiz</div>}
                      </div>
                    );
                  }
                },
                {
                  title: 'Boshqaruv', width: '25%', render: (_, r) => r.status === 'free' ? <Button type="primary" onClick={() => { setSelectedRoom(r.id); setModalOpen(true); setQrOpen(false); setOccupant(null); }}>Band qilish</Button> : (
                    <Space>
                      <Button danger onClick={() => receiveKey(r.id, r.occupant)}>Bo'shatish</Button>
                      {r.duration !== '-' && !isOverdue(r.time, r.duration) && getRemainingMinutes(r.time, r.duration) <= 5 && (
                        <Button icon={<HourglassOutlined />} type="primary" ghost onClick={() => { setSelectedRoom(r.id); setExtendModalOpen(true); }}>Uzaytirish</Button>
                      )}
                    </Space>
                  )
                }
              ]} />
            </div>
          )}

          {view === 'rooms_manage' && (
            <Card className="glass-card" title="Xonalar boshqaruvi">
              <Row gutter={24}><Col xs={24} md={12}><h4>Yakka qo'shish</h4><Row gutter={8} style={{ marginTop: 12 }}><Col span={16}><Input placeholder="Xona raqami" size="large" value={newRoomId} onChange={e => setNewRoomId(e.target.value)} /></Col><Col span={8}><Button type="primary" size="large" block onClick={addRoom}>Qo'shish</Button></Col></Row></Col><Col xs={24} md={12}><h4>Excel yuklash</h4><Upload beforeUpload={(f) => { const r = new FileReader(); r.onload = async (e) => { const json = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]]); const ids = json.map(row => String(row[Object.keys(row).find(k => k.toLowerCase().includes('xona') || k.toLowerCase().includes('id'))] || '').trim()).filter(id => id); await supabase.from('rooms').insert(ids.map(id => ({ id, status: 'free' }))); message.success("Yuklandi!"); fetchRooms(); }; r.readAsArrayBuffer(f); return false; }} showUploadList={false} style={{ marginTop: 12 }}><Button size="large" icon={<UploadOutlined />} type="primary" ghost>Fayl tanlash</Button></Upload></Col></Row>
              <Divider /><Table dataSource={rooms} rowKey="id" columns={[{ title: 'Xona raqami', dataIndex: 'id' }, { title: 'Boshqaruv', render: (_, r) => <Popconfirm title="Oʻchirilsinmi?" onConfirm={() => deleteRoom(r.id)}><Button danger icon={<DeleteOutlined />} /></Popconfirm> }]} pagination={{ pageSize: 10 }} />
            </Card>
          )}

          {view === 'users' && (
            <Card className="glass-card" title="Foydalanuvchilar boshqaruvi">
              <Row gutter={24}><Col xs={24} md={12}><h4>Yakka qo'shish</h4><div style={{ marginTop: 12 }}><Input placeholder="F.I.SH" size="large" value={newUserName} onChange={e => setNewUserName(e.target.value)} style={{ marginBottom: 10 }} /><Input.Password placeholder="Parol" size="large" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} style={{ marginBottom: 10 }} /><Select size="large" style={{ width: '100%', marginBottom: 10 }} value={newUserRole} onChange={setNewUserRole} options={[{ label: 'Oqituvchi', value: 'teacher' }, { label: 'Talaba', value: 'student' }, { label: 'Hodim', value: 'staff' }]} /><Button type="primary" size="large" block onClick={addUser}>Qo'shish</Button></div></Col><Col xs={24} md={12}><h4>Excel yuklash</h4><div style={{ marginTop: 12 }}><Select size="large" style={{ width: 150, marginRight: 10 }} value={newUserRole} onChange={setNewUserRole} options={[{ label: 'Oqituvchi', value: 'teacher' }, { label: 'Talaba', value: 'student' }, { label: 'Hodim', value: 'staff' }]} /><Upload beforeUpload={(f) => { const r = new FileReader(); r.onload = async (e) => { const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }); const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]); const items = json.map(row => ({ name: String(row[Object.keys(row).find(k => k.toLowerCase().includes('ism') || k.toLowerCase().includes('fish'))] || '').trim(), password: String(row[Object.keys(row).find(k => k.toLowerCase().includes('parol') || k.toLowerCase().includes('pass'))] || '').trim() })).filter(i => i.name); let m = 1000; users.forEach(u => { if (u.id && u.id.startsWith('RK-')) { const n = parseInt(u.id.split('-')[1]); if (!isNaN(n) && n > m) m = n; } }); await supabase.from('users').insert(items.map((item, i) => ({ id: `RK-${m + i + 1}`, name: item.name, password: item.password, role: newUserRole }))); message.success("Yuklandi!"); fetchUsers(); }; r.readAsArrayBuffer(f); return false; }} showUploadList={false}><Button size="large" icon={<FileExcelOutlined />} type="primary" ghost>Fayl tanlash</Button></Upload></div></Col></Row>
              <Divider /><Table dataSource={users} rowKey="id" columns={[{ title: 'ID', dataIndex: 'id', width: '15%', render: (id) => <Tag color="blue"><strong>{id}</strong></Tag> }, { title: 'F.I.SH', dataIndex: 'name' }, { title: 'Parol', dataIndex: 'password', render: (p) => p ? <Input.Password value={p} readOnly bordered={false} /> : '-' }, { title: 'Lavozimi', dataIndex: 'role', render: (r) => <Tag color={r === 'teacher' ? 'gold' : r === 'student' ? 'cyan' : 'purple'}>{r === 'teacher' ? 'O\'qituvchi' : r === 'student' ? 'Talaba' : 'Hodim'}</Tag> }, { title: 'Boshqaruv', width: '15%', render: (_, r) => <Space><Button icon={<EditOutlined />} onClick={() => { setEditingUser(r); setEditPassword(r.password || ''); setEditModalOpen(true); }} /><Popconfirm title="Oʻchirilsinmi?" onConfirm={() => deleteUser(r.id)}><Button danger icon={<DeleteOutlined />} /></Popconfirm></Space> }]} pagination={{ pageSize: 10 }} />
            </Card>
          )}

          {view === 'analytics' && <AnalyticsDashboard analytics={analytics} logs={logs} rooms={rooms} onRefresh={fetchAnalytics} onClearRequest={() => setPassModalOpen(true)} />}
        </Content>

        <Modal title={qrOpen ? "QR Skaner" : `Xona ${selectedRoom} — Band qilish`} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
          {!qrOpen ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}><label style={{ fontWeight: 500 }}>Tanlang</label><Button type="link" icon={<CameraOutlined />} onClick={() => setQrOpen(true)}>QR</Button></div>
              <Select showSearch size="large" style={{ width: '100%', marginBottom: 16 }} placeholder="Tanlang..." value={occupant} onChange={(val) => { setOccupant(val); if (val.includes('Talaba')) setRole('student'); else setRole('staff'); }} options={users.map(u => ({ label: `${u.name} (${u.role === 'teacher' ? 'O\'qituvchi' : u.role === 'student' ? 'Talaba' : 'Hodim'})`, value: `${u.name} (${u.role === 'teacher' ? 'O\'qituvchi' : u.role === 'student' ? 'Talaba' : 'Hodim'})` }))} />
              {(role === 'student' || (occupant && occupant.includes('(Talaba)'))) && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>Muddati:</label>
                  <Radio.Group value={duration} onChange={e => setDuration(e.target.value)} buttonStyle="solid" size="large">
                    <Radio.Button value={0.5}>30 daqiqa</Radio.Button>
                    <Radio.Button value={1}>1 soat</Radio.Button>
                    <Radio.Button value={1.5}>1.5 soat</Radio.Button>
                    <Radio.Button value={2}>2 soat</Radio.Button>
                  </Radio.Group>
                </div>
              )}
              <Button type="primary" size="large" block loading={actionLoading} onClick={confirmIssue} style={{ height: 45, borderRadius: 10 }}>Tasdiqlash</Button>
            </div>
          ) : (
            <div className="qr-scanner-container"><QRScanner onScan={handleQRScan} /><Button block onClick={() => setQrOpen(false)} style={{ marginTop: 10 }}>Orqaga</Button></div>
          )}
        </Modal>

        <Modal title="Vaqtni uzaytirish" open={extendModalOpen} onCancel={() => setExtendModalOpen(false)} footer={null} destroyOnClose>
          <p>Xona {selectedRoom} uchun qo'shimcha vaqt tanlang:</p>
          <Radio.Group value={duration} onChange={e => setDuration(e.target.value)} buttonStyle="solid" size="large" style={{ marginBottom: 20 }}>
            <Radio.Button value={0.5}>30 daqiqa</Radio.Button>
            <Radio.Button value={1}>1 soat</Radio.Button>
          </Radio.Group>
          <Button type="primary" block size="large" onClick={confirmExtend} loading={actionLoading}>Uzaytirishni tasdiqlash</Button>
          <p style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>* Umumiy muddat 2 soatdan oshib ketmasligi kerak.</p>
        </Modal>

        <Modal title="Parol" open={passModalOpen} onCancel={() => setPassModalOpen(false)} onOk={clearLogs} okText="Tozalash"><Input.Password value={inputPass} onChange={e => setInputPass(e.target.value)} /></Modal>

        <Modal title={`Parolni o'zgartirish: ${editingUser?.name}`} open={editModalOpen} onCancel={() => setEditModalOpen(false)} onOk={updateUser} okText="Saqlash"><Input.Password placeholder="Yangi parol" value={editPassword} onChange={e => setEditPassword(e.target.value)} /></Modal>
      </Layout>
    </ConfigProvider>
  );
}

function QRScanner({ onScan }) {
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, d => { onScan(d); html5QrCode.stop(); }).catch(() => { });
    return () => { if (html5QrCode.isScanning) html5QrCode.stop(); };
  }, []);
  return <div id="reader" style={{ width: '100%', minHeight: 250, background: '#000' }}></div>;
}

function AnalyticsDashboard({ analytics, logs, rooms, onRefresh, onClearRequest }) {
  return (
    <div className="animate-fade-in dashboard-analytics">
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={12}><Card className="glass-card" style={{ borderBottom: '3px solid #10b981' }}><Statistic title="Bugun olingan" value={analytics.todayTaken} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#059669' }} /></Card></Col>
        <Col xs={24} md={12}><Card className="glass-card" style={{ borderBottom: '3px solid #3b82f6' }}><Statistic title="Bugun qaytarilgan" value={analytics.todayReturned} prefix={<ArrowDownOutlined />} valueStyle={{ color: '#2563eb' }} /></Card></Col>
      </Row>
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={14}><Card className="glass-card compact-card" title={<span><TrophyOutlined /> Top 5 Faol Xonalar</span>} extra={<Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} />}><div className="top-rooms-grid">{analytics.roomUsage.slice(0, 5).map((room, i) => (<div key={room.id} className="top-room-item"><div className="rank">{i + 1}</div><div className="info"><strong>Xona {room.id}</strong></div><div className="val"><Badge count={room.count} color="#1e40af" /></div></div>))}</div></Card></Col>
        <Col xs={24} lg={10}><Card className="glass-card compact-card" title={<span><StopOutlined /> Foydalanilmagan</span>}><div className="idle-rooms-scroll"><Space wrap size={[8, 8]}>{analytics.idleRooms.map(id => <Tag key={id} className="idle-tag">Xona {id}</Tag>)}</Space></div></Card></Col>
      </Row>
      <Collapse accordion className="glass-card history-collapse" expandIconPosition="end">
        {rooms.map(room => {
          const roomLogs = logs.filter(l => String(l.room_id) === String(room.id));
          return (
            <Panel header={<div className="panel-header-flex"><span className="room-label">Xona {room.id}</span>{roomLogs.length > 0 ? <Tag color="blue" size="small">{roomLogs.length} harakat</Tag> : <Tag color="default" size="small">Yo'q</Tag>}</div>} key={room.id}>
              <Table size="small" pagination={roomLogs.length > 5 ? { pageSize: 5 } : false} dataSource={roomLogs} rowKey="id" columns={[{ title: 'Shaxs', dataIndex: 'occupant' }, { title: 'Harakat', dataIndex: 'action', render: (a) => <Tag color={a === 'Olingan' ? 'green' : 'blue'} size="small">{a}</Tag> }, { title: 'Vaqt', dataIndex: 'created_at', render: (d) => new Date(d).toLocaleTimeString() }]} />
            </Panel>
          );
        })}
      </Collapse>
      <div style={{ marginTop: 24, textAlign: 'center' }}><Button danger ghost size="small" onClick={onClearRequest}>Barcha tarixni tozalash</Button></div>
    </div>
  );
}

export default App;
