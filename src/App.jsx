import { useState, useEffect, useRef } from 'react';
import { Search, Info, QrCode, X, Check, CameraOff } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './index.css';

// TODO: Replace this with your Google Apps Script Web App URL after deploying Code.gs
const GAS_URL = "https://script.google.com/macros/s/AKfycbz7eDezENgv6HBbE2F32IGa6o6Mk7VKl_S8y2HIxkaq1EbOhWIi3pWkrFIKf2IR3wvg3w/exec";

function App() {
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [occupant, setOccupant] = useState('');
  const [role, setRole] = useState('teacher');
  const [duration, setDuration] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });

  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    fetchData(true);

    // Tizim har 15 soniyada orqa fonda jadvallarni tekshirib turadi (Live Sinxronizatsiya)
    const interval = setInterval(() => {
      fetchData(false);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async (showMainLoader = false) => {
    if (showMainLoader) setLoading(true);
    try {
      const res = await fetch(`${GAS_URL}?action=getAll`);
      // If CORS blocks this in dev, we fallback to mock data
      if (!res.ok) throw new Error("Tarmoq xatosi");

      const responseText = await res.text();
      // Google Apps Script usually wraps in JSON or redirect, so parse text
      const result = JSON.parse(responseText);

      if (result.success) {
        setRooms(result.data.rooms || []);
        setUsers(result.data.users || []);
      }
    } catch (e) {
      console.warn("GAS CORS error or invalid link. Using mock data for Vite dev mode.", e);
      setRooms([
        { id: '101', status: 'free', occupant: null, time: null },
        { id: '102', status: 'occupied', occupant: 'Alisher Navoiy', time: '08:30' },
        { id: '202', status: 'occupied', occupant: 'Mirzo Ulugbek (Talaba)', time: '09:00' }
      ]);
      setUsers([
        'Alisher Navoiy (Oqituvchi)',
        'Zahiriddin Muhammad Bobur (Oqituvchi)',
        'Mirzo Ulugbek (Talaba)'
      ]);
    }
    if (showMainLoader) setLoading(false);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value.toLowerCase());
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
    setOccupant('');
    setRole('');
    setDuration('');
    setSuggestions(users.map(u => u.name));
    setQrOpen(false);
    setModalOpen(true);
  };

  const closeBtn = () => {
    setModalOpen(false);
    if (qrOpen) setQrOpen(false);
  };

  const handleOccupantInput = (e) => {
    const val = e.target.value;
    setOccupant(val);
    const matches = users.filter((u) => u.name.toLowerCase().includes(val.toLowerCase()));
    setSuggestions(matches.map(m => m.name));
  };

  const selectSuggestion = (name) => {
    setOccupant(name);
    if (name.toLowerCase().includes('talaba')) {
      setRole('student');
    } else {
      setRole('teacher');
    }
  };

  const handleQRScan = (scannedId) => {
    const foundUser = users.find(u => u.id === scannedId);
    if (foundUser) {
      selectSuggestion(foundUser.name);
      setQrOpen(false);
    } else {
      // If it's not a known ID, maybe it's the name itself?
      const foundByName = users.find(u => u.name.includes(scannedId));
      if (foundByName) {
        selectSuggestion(foundByName.name);
        setQrOpen(false);
      } else {
        alert("Topilmadi: " + scannedId);
      }
    }
  };

  const showToastMsg = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const confirmIssue = async () => {
    if (!users.some(u => u.name === occupant)) {
      alert("Iltimos, ro'yxatdan xodim yoki talabani tanlang!");
      return;
    }
    if (role === 'student' && !duration) {
      alert("Iltimos, kalit necha soatga olinayotganini kiriting!");
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
        showToastMsg(data.message);
        fetchData();
        closeBtn();
      } else {
        alert(data.message || "Xatolik yuz berdi");
      }
    } catch (e) {
      // Mock logic for local testing
      setTimeout(() => {
        setRooms(rooms.map(r =>
          r.id === selectedRoom
            ? { ...r, status: 'occupied', occupant: occupant + (role === 'student' ? ` (${duration} soatga)` : ''), time: new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0') }
            : r
        ));
        closeBtn();
        showToastMsg('Sinov: xona band qilindi!');
      }, 500);
    } finally {
      setActionLoading(false);
    }
  };

  const receiveKey = async (roomId) => {
    if (!window.confirm(`Haqiqatan ham ${roomId}-xona kaliti qaytarilmoqdami (xona bo'shatilmoqdami)?`)) return;

    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'checkIn', roomId })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        showToastMsg(data.message);
      }
    } catch (e) {
      // Mock
      setRooms(rooms.map(r => r.id === roomId ? { ...r, status: 'free', occupant: null, time: null } : r));
      showToastMsg("Sinov orqali qaytarildi!");
    }
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="logo">
          <QrCode className="logo-icon" />
          Raqamli Kalitxona
        </div>
      </header>

      <main className="container">
        <div className="controls">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Xona yoki xodim/talabani qidirish..."
              value={search}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <div className="stats">
            <div className="stat">
              <div className="dot free"></div> Bo'sh: {freeCount}
            </div>
            <div className="stat">
              <div className="dot occupied"></div> Band: {occupiedCount}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loader-container">
            <div className="spinner"></div>
            <p>Ma'lumotlar yuklanmoqda...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="loader-container">
            <Info size={32} style={{ marginBottom: 10, color: 'var(--text-muted)' }} />
            <p>Xonalar topilmadi.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="rooms-table">
              <thead>
                <tr>
                  <th>Xona</th>
                  <th>Holat</th>
                  <th>Mas'ul shaxs</th>
                  <th>Vaqti / Muddati</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => {
                  const isFree = room.status === 'free';
                  let overdueEl = null;

                  if (!isFree && room.duration) {
                    const durMatch = String(room.duration).match(/(\d+)/);
                    if (durMatch && room.time) {
                      const durHours = parseInt(durMatch[1], 10);
                      const parts = String(room.time).split(':');
                      if (parts.length >= 2) {
                        const hh = parseInt(parts[0], 10);
                        const mm = parseInt(parts[1], 10);

                        const now = new Date();
                        let issueTime = new Date();
                        issueTime.setHours(hh, mm, 0, 0);

                        if (issueTime > now) {
                          issueTime.setDate(issueTime.getDate() - 1);
                        }

                        const dueTime = new Date(issueTime.getTime() + durHours * 60 * 60 * 1000);

                        if (now > dueTime) {
                          const diffMins = Math.floor((now - dueTime) / 60000);
                          const oHr = Math.floor(diffMins / 60);
                          const oMin = diffMins % 60;
                          const msg = oHr > 0 ? `${oHr}s ${oMin}m kechikdi!` : `${oMin}m kechikdi!`;
                          overdueEl = <div style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600, marginTop: 4 }}>⚠️ {msg}</div>;
                        } else {
                          overdueEl = <div style={{ color: '#6b7280', fontSize: '12px', marginTop: 2 }}>Muddati: {room.duration}</div>;
                        }
                      }
                    }
                  }

                  return (
                    <tr key={room.id} className={isFree ? 'row-free' : 'row-occupied'}>
                      <td className="col-room">{room.id}</td>
                      <td>
                        <span className={`badge ${isFree ? 'free' : 'occupied'}`}>
                          {isFree ? "Bo'sh" : 'Band'}
                        </span>
                      </td>
                      <td className="col-occupant">{isFree ? <span className="dimmed">-</span> : <span className="occupant-name">{room.occupant}</span>}</td>
                      <td>
                        {isFree ? <span className="dimmed">-</span> : (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="occupant-time">{room.time} da band qilindi</span>
                            {overdueEl}
                          </div>
                        )}
                      </td>
                      <td className="col-action">
                        {isFree ? (
                          <button className="btn-sm btn-primary" onClick={() => openModal(room.id)}>Band qilish</button>
                        ) : (
                          <button className="btn-sm btn-outline" onClick={() => receiveKey(room.id)}>Bo'shatish</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Xonani band qilish: {selectedRoom}-xona</h2>
              <button onClick={closeBtn} className="icon-btn"><X size={24} /></button>
            </div>

            <div className="form-group">
              <label>Xodim yoki Talaba (Ro'yxatdan tanlang)</label>
              {!users.includes(occupant) ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      value={occupant}
                      onChange={handleOccupantInput}
                      placeholder="Qidirish yoki skanerlang..."
                      className="input-field"
                    />
                    {suggestions.length > 0 && !qrOpen && (
                      <div className="suggestions">
                        {suggestions.map((s) => (
                          <div key={s} className="suggestion-item" onClick={() => selectSuggestion(s)}>
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-outline"
                    style={{ width: 'auto', padding: '0 15px' }}
                    onClick={() => setQrOpen(!qrOpen)}
                  >
                    {qrOpen ? <CameraOff size={20} /> : <QrCode size={20} />}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', padding: '10px 14px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{occupant}</span>
                  <button onClick={() => { setOccupant(''); setSuggestions(users); }} className="icon-btn" style={{ padding: 4, display: 'flex' }}>
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>

            {qrOpen && !users.some(u => u.name === occupant) && <QRScanner onScan={handleQRScan} />}


            {role === 'student' && (
              <div className="form-group">
                <label>Necha soatga?</label>
                <input
                  type="number"
                  min="1" max="10"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="input-field"
                  placeholder="Masalan: 2"
                />
              </div>
            )}

            <button className="btn-primary" onClick={confirmIssue} disabled={actionLoading} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              {actionLoading ? <div className="spinner sm"></div> : 'Tasdiqlash'}
            </button>
          </div>
        </div>
      )}

      <div className={`toast ${toast.show ? 'show' : ''}`}>
        <Check size={18} /> {toast.message}
      </div>
    </div>
  );
}

function QRScanner({ onScan }) {
  useEffect(() => {
    // High-level scanner is more stable for cross-browser
    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        videoConstraints: { facingMode: "environment" }, // Orqa kamerani tanlash
        rememberLastUsedCamera: true
      },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear().then(() => {
          onScan(decodedText);
        });
      },
      (err) => { /* ignore repeated errors */ }
    );

    return () => {
      scanner.clear().catch(e => console.warn("Scanner clear failed", e));
    };
  }, [onScan]);

  return (
    <div style={{ marginBottom: 15 }}>
      <div id="reader" style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}></div>
      <p style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: 5 }}>
        Kamera yoqilmoqda, iltimos ruxsat bering...
      </p>
    </div>
  );
}

export default App;
