import React, { useState, useEffect } from 'react';
import { 
  Layout, Card, Input, Button, Row, Col, Typography, 
  message, Tag, Modal, Space, Badge, ConfigProvider,
  Spin, Empty, Result
} from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  LoginOutlined, 
  LogoutOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { supabase } from './supabaseClient';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export default function StudentApp({ user, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('id');
    setRooms(data || []);
    checkActiveBooking(user.id);
  };

  const checkActiveBooking = async (uid) => {
    const { data } = await supabase.from('rooms').select('*').eq('occupant_id', uid).single();
    if (data) setActiveBooking(data);
    else setActiveBooking(null);
  };

  const bookRoom = async (room) => {
    if (activeBooking) return message.warning("Sizda allaqachon band qilingan xona bor!");
    if (room.status !== 'free') return message.error("Xona hozir band!");
    setSelectedRoom(room);
  };

  const confirmBooking = async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('rooms').update({
      status: 'occupied',
      occupant: user.name,
      occupant_id: user.id,
      time: new Date().toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }),
      duration: '2 soat'
    }).eq('id', selectedRoom.id);

    if (!error) {
      await supabase.from('logs').insert({ room_id: selectedRoom.id, occupant: user.name, action: 'Olingan', duration: '2 soat' });
      message.success("Xona 2 soatga band qilindi!");
      fetchRooms();
      setSelectedRoom(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
    const sub = supabase.channel('rooms_student').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchRooms()).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  return (
    <Layout className="student-layout" style={{ minHeight: '100vh' }}>
      <Header className="student-header" style={{ height: 'auto', padding: '0 20px', background: '#1e40af' }}>
        <div className="header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 70 }}>
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DatabaseOutlined style={{ fontSize: 24, color: '#fff' }} />
            <span className="brand-title" style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Raqamli Kalitxona</span>
          </div>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <Badge dot status="success"><Tag color="blue" style={{ margin: 0 }}>{user.name}</Tag></Badge>
            <Button type="text" icon={<LogoutOutlined />} onClick={onLogout} style={{ color: '#fff' }} />
          </div>
        </div>
      </Header>
      
      <Content className="main-container" style={{ padding: '20px' }}>
        {activeBooking ? (
          <Row justify="center" style={{ marginTop: 20 }}>
            <Col xs={24} sm={20} md={16} lg={12} xl={10}>
              <Card className="glass-card active-card" bordered={false}>
                <div className="active-header" style={{ textAlign: 'center', marginBottom: 20 }}>
                  <Badge status="processing" text={<Title level={4} style={{ margin: 0 }}>Sizning Band Xonangiz</Title>} />
                </div>
                <div className="active-room-box" style={{ 
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  padding: '30px', borderRadius: 20, textAlign: 'center', marginBottom: 20
                }}>
                  <div className="room-num" style={{ fontSize: 14, color: '#1e40af', fontWeight: 600 }}>XONA</div>
                  <h1 style={{ fontSize: '4rem', margin: 0, color: '#1e40af', fontWeight: 900 }}>{activeBooking.id}</h1>
                </div>
                <div className="active-details" style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
                  <Tag icon={<ClockCircleOutlined />} color="blue">Muddat: 2 soat</Tag>
                  <Tag icon={<EnvironmentOutlined />} color="blue">B-blok</Tag>
                </div>
                <Result status="success" title="Xona kalitini navbatchidan oling" subTitle="Vaqtingiz tugagach kalitni topshirishni unutmang!" />
              </Card>
            </Col>
          </Row>
        ) : (
          <div className="container">
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Title level={4}>Xona tanlang</Title>
              <Text type="secondary">Band qilmoqchi bo'lgan xonangiz ustiga bosing</Text>
            </div>
            {loading && rooms.length === 0 ? <Spin size="large" style={{ display: 'block', margin: '40px auto' }} /> : (
              <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                {rooms.map(room => (
                  <Col xs={12} sm={8} md={6} lg={4} key={room.id}>
                    <Card 
                      hoverable 
                      className={`glass-card room-card ${room.status === 'free' ? 'free' : 'busy'}`}
                      onClick={() => bookRoom(room)}
                      style={{ 
                        textAlign: 'center', borderRadius: 16, 
                        border: room.status === 'free' ? '2px solid #f0fdf4' : 'none',
                        opacity: room.status === 'free' ? 1 : 0.7
                      }}
                    >
                      <div className="room-label" style={{ fontSize: 11, color: '#94a3b8' }}>XONA</div>
                      <h3 style={{ fontSize: '1.8rem', margin: '5px 0' }}>{room.id}</h3>
                      <Tag color={room.status === 'free' ? 'green' : 'red'} style={{ borderRadius: 10 }}>
                        {room.status === 'free' ? 'BO\'SH' : 'BAND'}
                      </Tag>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
            {rooms.length === 0 && !loading && <Empty description="Hozircha xonalar mavjud emas" />}
          </div>
        )}
      </Content>

      <Modal
        title="Xonani tasdiqlash"
        open={!!selectedRoom}
        onOk={confirmBooking}
        onCancel={() => setSelectedRoom(null)}
        confirmLoading={loading}
        okText="Band qilish"
        cancelText="Bekor qilish"
      >
        <Result
          icon={<CalendarOutlined style={{ color: '#1e40af' }} />}
          title={`Xona ${selectedRoom?.id} ni band qilmoqchimisiz?`}
          subTitle="Xona 2 soat muddatga sizga beriladi. Bu vaqt ichida boshqa xonani band qila olmaysiz."
        />
      </Modal>
    </Layout>
  );
}
