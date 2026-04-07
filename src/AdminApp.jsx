import React, { useState, useEffect } from 'react';
import {
  ConfigProvider, Layout, Menu, Input, Table, Tag, Button,
  Modal, Card, Row, Col, Statistic, Select, InputNumber, Radio, Typography,
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
const { Title, Text } = Typography;

function QRScannerComponent({ onScan, onClose }) {
  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    scanner.start({ facingMode: "environment" }, config, (text) => {
      onScan(text);
    }).catch(err => {
      console.error("Scanner error:", err);
      message.error("Kameraga ulanib bo'lmadi!");
    });

    return () => {
      scanner.stop().catch(e => console.warn("Stop error:", e));
    };
  }, []);

  return <div id="qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}></div>;
}

export default function AdminApp({ onLogout }) {
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); 
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

  const fetchInitialData = async () => {
    setLoading(true);
    const roomsData = await fetchRooms();
    await fetchUsers();
    await fetchAnalytics(roomsData);
    setLoading(false);
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('id', { ascending: true });
    if (data) { setRooms(data); return data; }
    return [];
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('name', { ascending: true });
    if (data) setUsers(data);
  };

  const fetchAnalytics = async (roomsList) => {
    const activeRooms = roomsList || rooms;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
    const { data: allLogs } = await supabase.from('logs').select('*').order('created_at', { ascending: false });
    if (!allLogs) return;
    setLogs(allLogs);
    let metrics = { olingan: 0, qaytarilgan: 0, rooms: {}, todayUsed: new Set() };
    allLogs.forEach(l => {
      const logLocalDate = new Date(l.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
      if (logLocalDate === todayStr) {
        if (l.action === 'Olingan') { metrics.olingan++; metrics.rooms[l.room_id] = (metrics.rooms[l.room_id] || 0) + 1; metrics.todayUsed.add(l.room_id); }
        else if (l.action === 'Qaytarildi') metrics.qaytarilgan++;
      }
    });
    setAnalytics({
      todayTaken: metrics.olingan, todayReturned: metrics.qaytarilgan,
      roomUsage: Object.entries(metrics.rooms).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
      idleRooms: activeRooms.filter(r => !metrics.todayUsed.has(String(r.id))).map(r => r.id)
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
    const t = new Date().toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false });
    const durStr = (occupant.includes('(Talaba)')) ? `${duration} soat` : '-';
    await supabase.from('rooms').update({ status: 'occupied', occupant, time: t, duration: durStr }).eq('id', selectedRoom);
    await supabase.from('logs').insert([{ room_id: String(selectedRoom), occupant, action: 'Olingan', duration: durStr }]);
    message.success("Kalit berildi!"); setModalOpen(false); setActionLoading(false); fetchInitialData();
  };

  const receiveKey = async (roomId, o) => {
    Modal.confirm({
      title: "Qabul qilish?", onOk: async () => {
        await supabase.from('rooms').update({ status: 'free', occupant: null, time: null, duration: null }).eq('id', roomId);
        await supabase.from('logs').insert([{ room_id: String(roomId), occupant: o, action: 'Qaytarildi', duration: '-' }]);
      }
    });
  };

  const handleQRScan = (id) => {
    const found = users.find(u => u.id === id);
    if (found) {
      setOccupant(`${found.name} (${found.role === 'teacher' ? 'O\'qituvchi' : found.role === 'student' ? 'Talaba' : 'Hodim'})`);
      setRole(found.role);
      setQrOpen(false);
      message.success(`${found.name} aniqlandi.`);
    } else {
      message.error("ID topilmadi! (" + id + ")");
    }
  };

  if (isBlocked) {
    return <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Result status="warning" title="Bazani tozalash muddati!" /></Layout>;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header className="header-glass admin-header" style={{ height: 'auto', minHeight: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="brand-title"><DashboardOutlined /> Raqamli Kalitxona</div>
        <div className="header-nav-wrap" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Menu mode="horizontal" selectedKeys={[view]} onClick={(e) => setView(e.key)} style={{ border: 'none', background: 'transparent' }} items={[{ key: 'list', icon: <KeyOutlined />, label: 'Kalitlar' }, { key: 'rooms_manage', icon: <ApartmentOutlined />, label: 'Xonalar' }, { key: 'users', icon: <TeamOutlined />, label: 'Foydalanuvchilar' }, { key: 'analytics', icon: <BarChartOutlined />, label: 'Statistika' }]} />
          <Button danger icon={<LogoutOutlined />} onClick={onLogout}>Chiqish</Button>
        </div>
      </Header>

      <Content className="main-container animate-fade-in">
        {view === 'list' && (
          <div className="glass-card table-glass">
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col xs={24} md={12}><Input size="large" placeholder="Qidirish raqam yoki ism..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value.toLowerCase())} /></Col>
              <Col xs={24} md={12} style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}><Button size="large" icon={<ReloadOutlined />} onClick={fetchInitialData} loading={loading} /></Col>
            </Row>
            <Table scroll={{ x: 700 }} dataSource={rooms.filter(r => String(r.id).includes(search) || (r.occupant && r.occupant.toLowerCase().includes(search)))} rowKey="id" pagination={{ pageSize: 12 }} rowClassName={(r) => r.status === 'occupied' && isOverdue(r.time, r.duration) ? 'overdue-row' : ''} columns={[
              { title: 'Xona', dataIndex: 'id', width: 80, render: (t) => <strong>{t}</strong> },
              { title: 'Holati', dataIndex: 'status', width: 100, render: (s) => s === 'free' ? <Tag color="success">BO'SH</Tag> : <Badge status="error" text="BAND" /> },
              { title: "Mas'ul shaxs", dataIndex: 'occupant', ellipsis: true },
              { title: 'Vaqt / Muddat', width: 120, render: (_, r) => r.status === 'occupied' ? <Space direction="vertical" size={0}><Text strong style={{ color: isOverdue(r.time, r.duration) ? '#dc2626' : 'inherit' }}>{r.time}</Text><Text type="secondary" size="small">{r.duration}</Text></Space> : '-' },
              { title: 'Boshqaruv', width: 140, render: (_, r) => r.status === 'free' ? <Button type="primary" block size="small" onClick={() => { setSelectedRoom(r.id); setModalOpen(true); }}>Kalit berish</Button> : <Button danger ghost block size="small" onClick={() => receiveKey(r.id, r.occupant)}>Qabul qilish</Button> }
            ]} />
          </div>
        )}

        {view === 'rooms_manage' && (
          <Card className="glass-card" title="Xonalar boshqaruvi">
            <Row gutter={24}><Col xs={24} md={12}><h4>Yakka qo'shish</h4><Row gutter={8} style={{ marginTop: 12 }}><Col span={16}><Input placeholder="Xona raqami" size="large" value={newRoomId} onChange={e => setNewRoomId(e.target.value)} /></Col><Col span={8}><Button type="primary" size="large" block onClick={addRoom}>Qo'shish</Button></Col></Row></Col><Col xs={24} md={12}><h4>Excel yuklash</h4><Upload beforeUpload={(f) => { const r = new FileReader(); r.onload = async (e) => { const json = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]]); const ids = json.map(row => String(row[Object.keys(row).find(k => k.toLowerCase().includes('xona') || k.toLowerCase().includes('id'))] || '').trim()).filter(id => id); await supabase.from('rooms').insert(ids.map(id => ({ id, status: 'free' }))); message.success("Yuklandi!"); fetchRooms(); }; r.readAsArrayBuffer(f); return false; }} showUploadList={false} style={{ marginTop: 12 }}><Button size="large" icon={<UploadOutlined />} type="primary" ghost>Fayl tanlash</Button></Upload></Col></Row>
            <Divider /><Table scroll={{ x: 600 }} dataSource={rooms} rowKey="id" columns={[{ title: 'Xona raqami', dataIndex: 'id' }, { title: 'Boshqaruv', render: (_, r) => <Popconfirm title="Oʻchirilsinmi?" onConfirm={() => deleteRoom(r.id)}><Button danger icon={<DeleteOutlined />} /></Popconfirm> }]} pagination={{ pageSize: 10 }} />
          </Card>
        )}

        {view === 'users' && (
          <Card className="glass-card" title="Foydalanuvchilar boshqaruvi">
            <Row gutter={24}><Col xs={24} md={12}><h4>Yakka qo'shish</h4><div style={{ marginTop: 12 }}><Input placeholder="F.I.SH" size="large" value={newUserName} onChange={e => setNewUserName(e.target.value)} style={{ marginBottom: 10 }} /><Input.Password placeholder="Parol" size="large" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} style={{ marginBottom: 10 }} /><Select size="large" style={{ width: '100%', marginBottom: 10 }} value={newUserRole} onChange={setNewUserRole} options={[{ label: 'Oqituvchi', value: 'teacher' }, { label: 'Talaba', value: 'student' }, { label: 'Hodim', value: 'staff' }]} /><Button type="primary" size="large" block onClick={addUser}>Qo'shish</Button></div></Col><Col xs={24} md={12}><h4>Excel yuklash</h4><div style={{ marginTop: 12 }}><Select size="large" style={{ width: 150, marginRight: 10 }} value={newUserRole} onChange={setNewUserRole} options={[{ label: 'Oqituvchi', value: 'teacher' }, { label: 'Talaba', value: 'student' }, { label: 'Hodim', value: 'staff' }]} /><Upload beforeUpload={(f) => { const r = new FileReader(); r.onload = async (e) => { const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }); const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]); const items = json.map(row => ({ name: String(row[Object.keys(row).find(k => k.toLowerCase().includes('ism') || k.toLowerCase().includes('fish'))] || '').trim(), password: String(row[Object.keys(row).find(k => k.toLowerCase().includes('parol') || k.toLowerCase().includes('pass'))] || '').trim() })).filter(i => i.name); let m = 1000; users.forEach(u => { if (u.id && u.id.startsWith('RK-')) { const n = parseInt(u.id.split('-')[1]); if (!isNaN(n) && n > m) m = n; } }); await supabase.from('users').insert(items.map((item, i) => ({ id: `RK-${m + i + 1}`, name: item.name, password: item.password, role: newUserRole }))); message.success("Yuklandi!"); fetchUsers(); }; r.readAsArrayBuffer(f); return false; }} showUploadList={false}><Button size="large" icon={<FileExcelOutlined />} type="primary" ghost>Fayl tanlash</Button></Upload></div></Col></Row>
            <Divider /><Table scroll={{ x: 800 }} dataSource={users} rowKey="id" columns={[{ title: 'ID', dataIndex: 'id', width: '15%', render: (id) => <Tag color="blue"><strong>{id}</strong></Tag> }, { title: 'F.I.SH', dataIndex: 'name' }, { title: 'Parol', dataIndex: 'password', render: (p) => p ? <Input.Password value={p} readOnly bordered={false} /> : '-' }, { title: 'Lavozimi', dataIndex: 'role', render: (r) => <Tag color={r === 'teacher' ? 'gold' : r === 'student' ? 'cyan' : 'purple'}>{r === 'teacher' ? 'O\'qituvchi' : r === 'student' ? 'Talaba' : 'Hodim'}</Tag> }, { title: 'Boshqaruv', width: '15%', render: (_, r) => <Space><Button icon={<EditOutlined />} onClick={() => { setEditingUser(r); setEditPassword(r.password || ''); setEditModalOpen(true); }} /><Popconfirm title="Oʻchirilsinmi?" onConfirm={() => deleteUser(r.id)}><Button danger icon={<DeleteOutlined />} /></Popconfirm></Space> }]} pagination={{ pageSize: 12 }} />
          </Card>
        )}

        {view === 'analytics' && (
          <div className="animate-fade-in" style={{ padding: '0 10px' }}>
            <Row gutter={[16, 16]}>
              <Col xs={12} lg={6}><Card className="glass-card stat-card"><Statistic title="Bugun olingan" value={analytics.todayTaken} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#10b981' }} /></Card></Col>
              <Col xs={12} lg={6}><Card className="glass-card stat-card"><Statistic title="Bugun qaytarilgan" value={analytics.todayReturned} prefix={<ArrowDownOutlined />} valueStyle={{ color: '#1e40af' }} /></Card></Col>
              <Col xs={24} lg={12}><Card className="glass-card stat-card"><Title level={5} style={{ margin: 0, marginBottom: 10 }}>Foydalanilmagan xonalar ({analytics.idleRooms.length})</Title><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{analytics.idleRooms.length > 0 ? analytics.idleRooms.map(id => <Tag key={id} color="default">{id}</Tag>) : <Text type="secondary">Barchasi ishlatildi</Text>}</div></Card></Col>
            </Row>
            <Card className="glass-card" style={{ marginTop: 16 }} title="Xonalar harakati tarixi">
              <Collapse accordion className="glass-card history-collapse" expandIconPosition="end">
                {rooms.map(room => {
                  const roomLogs = logs.filter(l => String(l.room_id) === String(room.id));
                  return (
                    <Panel header={<div className="panel-header-flex"><span className="room-label">Xona {room.id}</span>{roomLogs.length > 0 ? <Tag color="blue" size="small">{roomLogs.length} harakat</Tag> : <Tag color="default" size="small">Yo'q</Tag>}</div>} key={room.id}>
                      <Table scroll={{ x: 400 }} size="small" pagination={roomLogs.length > 5 ? { pageSize: 5 } : false} dataSource={roomLogs} rowKey="id" columns={[{ title: 'Shaxs', dataIndex: 'occupant' }, { title: 'Harakat', dataIndex: 'action', render: (a) => <Tag color={a === 'Olingan' ? 'green' : 'blue'} size="small">{a}</Tag> }, { title: 'Vaqt', dataIndex: 'created_at', render: (d) => new Date(d).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent' }) }]} />
                    </Panel>
                  );
                })}
              </Collapse>
            </Card>
          </div>
        )}
      </Content>

      <Modal title="Kalit berish" open={modalOpen} onOk={confirmIssue} onCancel={() => setModalOpen(false)} confirmLoading={actionLoading} okText="Tasdiqlash" cancelText="Bekor qilish" width={400}>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <Title level={4} style={{ color: '#1e40af' }}>Xona {selectedRoom}</Title>
          <Button icon={<CameraOutlined />} block size="large" onClick={() => setQrOpen(true)} style={{ marginBottom: 15 }}>QR-kodni skanerlash</Button>
          <Divider>yoki</Divider>
          <Select showSearch size="large" placeholder="Shaxsni tanlang" style={{ width: '100%', marginBottom: 15 }} onChange={(v) => { setOccupant(v); const found = users.find(u => `${u.name} (${u.role === 'teacher' ? 'O\'qituvchi' : u.role === 'student' ? 'Talaba' : 'Hodim'})` === v); if (found) setRole(found.role); }} options={users.map(u => ({ label: `${u.name} (${u.role === 'teacher' ? 'O\'qituvchi' : u.role === 'student' ? 'Talaba' : 'Hodim'})`, value: `${u.name} (${u.role === 'teacher' ? 'O\'qituvchi' : u.role === 'student' ? 'Talaba' : 'Hodim'})` }))} />
          {role === 'student' && <div style={{ marginBottom: 15 }}><Text type="secondary">Muddat (soat):</Text><InputNumber min={0.5} max={2} step={0.5} value={duration} onChange={setDuration} style={{ marginLeft: 10 }} /></div>}
        </div>
      </Modal>

      <Modal title="QR-kod Skaner" open={qrOpen} onCancel={() => setQrOpen(false)} footer={null} width={400} destroyOnClose centered>
        {qrOpen && <QRScannerComponent onScan={handleQRScan} onClose={() => setQrOpen(false)} />}
      </Modal>

      <Modal title="Ma'lumotlarni tahrirlash" open={editModalOpen} onOk={updateUser} onCancel={() => setEditModalOpen(false)} okText="Saqlash">
        <Text type="secondary">Foydalanuvchi: {editingUser?.name}</Text>
        <Input.Password style={{ marginTop: 15 }} placeholder="Yangi parol" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
      </Modal>
    </Layout>
  );
}
