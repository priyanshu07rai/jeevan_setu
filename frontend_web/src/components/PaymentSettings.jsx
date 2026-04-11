import React, { useState, useEffect, useRef } from 'react';
import { fetchPaymentConfig, updatePaymentConfig } from '../services/api';

/**
 * PaymentSettings — Admin panel for managing payment configuration.
 * Shows current config, allows editing fields and uploading a new QR image.
 * Embedded as a tab/panel inside AdminDashboard.
 */
export default function PaymentSettings() {
  const [config, setConfig] = useState({
    upi_id: '', account_name: '', account_number: '', ifsc: '', bank_name: ''
  });
  const [qrPreview, setQrPreview]     = useState(null); // live preview URL
  const [qrFile, setQrFile]           = useState(null);
  const [currentQR, setCurrentQR]     = useState('');   // existing server QR URL
  const [removeQR, setRemoveQR]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState('');
  const fileRef                        = useRef();

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    const data = await fetchPaymentConfig();
    if (data) {
      setConfig({
        upi_id:         data.upi_id         || '',
        account_name:   data.account_name   || '',
        account_number: data.account_number || '',
        ifsc:           data.ifsc           || '',
        bank_name:      data.bank_name      || '',
      });
      setCurrentQR(data.qr_image_url_full || '');
      setRemoveQR(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQrFile(file);
    setQrPreview(URL.createObjectURL(file));
    setRemoveQR(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const fd = new FormData();
      fd.append('upi_id',         config.upi_id);
      fd.append('account_name',   config.account_name);
      fd.append('account_number', config.account_number);
      fd.append('ifsc',           config.ifsc);
      fd.append('bank_name',      config.bank_name);
      if (qrFile) fd.append('qr_image', qrFile);
      fd.append('remove_qr', removeQR);

      await updatePaymentConfig(fd);
      setSaved(true);
      await loadConfig(); // refresh stored config
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'white',
    padding: '14px 16px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text3)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    display: 'block',
  };

  const activeQR = removeQR ? null : (qrPreview || currentQR);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>⚙️ Payment Settings</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Configure the UPI ID, bank details, and QR code that citizens see on the Donor Portal.
          Changes reflect instantly.
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

          {/* LEFT — Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* UPI */}
            <div>
              <label style={labelStyle}>UPI ID</label>
              <input
                style={inputStyle}
                placeholder="yourname@upi"
                value={config.upi_id}
                onChange={e => setConfig({ ...config, upi_id: e.target.value })}
              />
            </div>

            {/* Account Name */}
            <div>
              <label style={labelStyle}>Account Name</label>
              <input
                style={inputStyle}
                placeholder="Relief Fund Trust"
                value={config.account_name}
                onChange={e => setConfig({ ...config, account_name: e.target.value })}
              />
            </div>

            {/* Account Number */}
            <div>
              <label style={labelStyle}>Account Number</label>
              <input
                style={inputStyle}
                placeholder="00000000000000"
                value={config.account_number}
                onChange={e => setConfig({ ...config, account_number: e.target.value })}
              />
            </div>

            {/* IFSC */}
            <div>
              <label style={labelStyle}>IFSC Code</label>
              <input
                style={inputStyle}
                placeholder="SBIN0001234"
                value={config.ifsc}
                onChange={e => setConfig({ ...config, ifsc: e.target.value.toUpperCase() })}
              />
            </div>

            {/* Bank Name */}
            <div>
              <label style={labelStyle}>Bank Name</label>
              <input
                style={inputStyle}
                placeholder="State Bank of India"
                value={config.bank_name}
                onChange={e => setConfig({ ...config, bank_name: e.target.value })}
              />
            </div>

          </div>

          {/* RIGHT — QR Upload + Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <label style={labelStyle}>QR Code Image</label>

              {/* QR Preview Box */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%',
                  height: 220,
                  borderRadius: 16,
                  border: `2px dashed ${activeQR ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: activeQR ? 'rgba(232,99,10,0.04)' : 'rgba(255,255,255,0.02)',
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'all 0.2s',
                }}
              >
                {activeQR ? (
                  <img
                    src={activeQR}
                    alt="QR Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16 }}
                  />
                ) : (
                  <>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
                      Click to upload QR image<br />
                      <span style={{ fontSize: 10 }}>PNG, JPG, WebP supported</span>
                    </div>
                  </>
                )}

                {/* Overlay on hover */}
                {activeQR && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s',
                    borderRadius: 14,
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  >
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>🔄 Change QR</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
                <div>
                  {removeQR ? <span style={{color: '#f43f5e'}}>QR image scheduled for removal</span> : qrFile ? `New file: ${qrFile.name}` : currentQR ? 'Current QR is active ↑' : 'No QR uploaded yet'}
                </div>
                {(currentQR || qrFile) && !removeQR && (
                  <button type="button" onClick={() => { setQrFile(null); setQrPreview(null); if(currentQR) setRemoveQR(true); }} style={{background:'transparent', border:'none', color:'#f43f5e', cursor:'pointer', fontSize:10, textDecoration:'underline'}}>Remove Image</button>
                )}
                {removeQR && (
                  <button type="button" onClick={() => setRemoveQR(false)} style={{background:'transparent', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:10, textDecoration:'underline'}}>Undo</button>
                )}
              </div>
            </div>

            {/* Live preview card of what citizen sees */}
            <div style={{
              background: 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 14, padding: '16px 20px',
            }}>
              <div style={{ fontSize: 10, color: '#10b981', fontWeight: 900, letterSpacing: 1, marginBottom: 12 }}>👁 CITIZEN PREVIEW</div>
              {config.upi_id && (
                <div style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'white', marginBottom: 6 }}>
                  UPI: <span style={{ color: 'var(--accent)' }}>{config.upi_id}</span>
                </div>
              )}
              {config.account_number && (
                <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.8 }}>
                  {config.account_name && <div>Name: {config.account_name}</div>}
                  <div>Acc: {config.account_number}</div>
                  {config.ifsc && <div>IFSC: {config.ifsc}</div>}
                  {config.bank_name && <div>Bank: {config.bank_name}</div>}
                </div>
              )}
              {!config.upi_id && !config.account_number && (
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Fill fields to see preview</div>
              )}
            </div>

          </div>
        </div>

        {/* Save Button */}
        <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saved
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, var(--accent), #f97316)',
              border: 'none',
              borderRadius: 14,
              padding: '16px 40px',
              color: 'white',
              fontSize: 14,
              fontWeight: 900,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 8px 24px rgba(232,99,10,0.25)',
              transition: 'all 0.3s',
              letterSpacing: 0.5,
            }}
          >
            {saving ? '⏳ Saving...' : saved ? '✅ Saved! Citizens see updated config' : '💾 Save Payment Config'}
          </button>

          {error && (
            <div style={{ color: '#f43f5e', fontSize: 12 }}>⚠️ {error}</div>
          )}
        </div>
      </form>
    </div>
  );
}
