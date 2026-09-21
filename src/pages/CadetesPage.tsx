import { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import { emptyDireccionParts, formatDireccionParts } from '../lib/direccion';
import { fleetMarkerColor, fleetMarkerLabel } from '../lib/gps';
import {
  connectAdminSocket,
  type CadeteUbicacionEvent,
} from '../lib/socket';
import type { CadeteAdmin } from '../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../components/ui';
import { MapView } from '../components/MapView';

function getToken(): string | null {
  return localStorage.getItem('sd_token');
}

function toneVerif(v: string) {
  if (v === 'aprobado') return 'ok' as const;
  if (v === 'pendiente' || v === 'en_revision') return 'warn' as const;
  return 'danger' as const;
}

function estadoBadgeTone(estado?: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (estado === 'activo') return 'ok';
  if (estado === 'inactivo') return 'danger';
  if (estado === 'suspendido') return 'warn';
  return 'neutral';
}

const DOC_FIELDS = [
  { id: 'dni' as const, label: 'DNI (PDF)' },
  { id: 'carnet' as const, label: 'Carnet de manejo (PDF)' },
  { id: 'seguro' as const, label: 'Seguro (PDF)' },
  { id: 'afip' as const, label: 'Constancia AFIP (PDF)' },
  { id: 'rentas' as const, label: 'Constancia de Rentas (PDF)' },
];

const PLANES_CADETE = ['trial', 'silver', 'gold', 'premium'] as const;

const emptyForm = {
  nombre: '',
  email: '',
  telefono: '',
  password: '',
  dni: '',
  licencia: '',
  fecha_nacimiento: '1995-01-15',
  marca_moto: '',
  patente: '',
  direccion_parts: emptyDireccionParts(),
  aprobar: true,
};

type DocId = (typeof DOC_FIELDS)[number]['id'];

function makeEditForm(c: CadeteAdmin) {
  return {
    nombre: c.nombre ?? '',
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    dni: c.dni,
    licencia: c.licencia,
    patente: c.patente,
    marca_moto: c.marca_moto ?? '',
    plan_suscripcion: c.plan_suscripcion,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function docsLinks(c: CadeteAdmin) {
  const f = c.fotos_documentos ?? {};
  const pairs: Array<{ label: string; href?: string }> = [
    { label: 'DNI', href: f.dni_pdf },
    { label: 'Carnet', href: f.carnet_pdf },
    { label: 'Seguro', href: f.seguro_pdf },
    { label: 'AFIP', href: f.afip_pdf },
    { label: 'Rentas', href: f.rentas_pdf },
  ];
  return pairs.filter((p) => p.href);
}

export function CadetesPage() {
  const [items, setItems] = useState<CadeteAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [docs, setDocs] = useState<Partial<Record<DocId, File | null>>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CadeteAdmin | null>(null);
  const [editForm, setEditForm] = useState(makeEditForm({} as CadeteAdmin));
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'live' | 'off'>('connecting');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    setError(null);
    adminApi
      .cadetes()
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setSocketStatus('off');
      return;
    }

    const socket = connectAdminSocket(token);
    setSocketStatus('connecting');

    socket.on('connect', () => setSocketStatus('live'));
    socket.on('disconnect', () => setSocketStatus('off'));
    socket.on('connect_error', () => setSocketStatus('off'));

    socket.on('cadete:ubicacion', (payload: CadeteUbicacionEvent) => {
      if (typeof payload?.lat !== 'number' || typeof payload?.lng !== 'number') return;
      if (!payload.cadete_id) return;
      const ts = payload.ts ?? new Date().toISOString();
      setItems((prev) => {
        if (!prev) return prev;
        return prev.map((c) => {
          if (c.usuario_id !== payload.cadete_id) return c;
          return {
            ...c,
            ubicacion_actual: { lat: payload.lat, lng: payload.lng },
            ubicacion_actualizada_en: ts,
            disponibilidad: payload.disponibilidad ?? c.disponibilidad,
          };
        });
      });
      setNow(Date.now());
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  async function action(id: string, estado: string) {
    setBusy(id);
    try {
      await adminApi.patchCadete(id, estado);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function bajaCadete(c: CadeteAdmin) {
    if (!window.confirm(`¿Dar de baja a "${c.nombre ?? c.dni}"?`)) return;
    setBusy(c.usuario_id);
    setError(null);
    try {
      await adminApi.bajaCadete(c.usuario_id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar de baja');
    } finally {
      setBusy(null);
    }
  }

  async function reactivarCadete(c: CadeteAdmin) {
    setBusy(c.usuario_id);
    setError(null);
    try {
      await adminApi.reactivarCadete(c.usuario_id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reactivar');
    } finally {
      setBusy(null);
    }
  }

  function openEdit(c: CadeteAdmin) {
    setEditTarget(c);
    setEditForm(makeEditForm(c));
    setEditError(null);
    setEditOpen(true);
  }

  async function onEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await adminApi.actualizarCadete(editTarget.usuario_id, {
        nombre: editForm.nombre,
        email: editForm.email,
        telefono: editForm.telefono,
        dni: editForm.dni,
        licencia: editForm.licencia,
        patente: editForm.patente,
        marca_moto: editForm.marca_moto || null,
        plan_suscripcion: editForm.plan_suscripcion,
      });
      setEditOpen(false);
      setEditTarget(null);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setEditSaving(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (!form.direccion_parts.calle.trim() || !form.direccion_parts.numero.trim()) {
        throw new Error('Calle y número son obligatorios');
      }
      if (!form.direccion_parts.barrio.trim()) {
        throw new Error('El barrio es obligatorio (define la zona)');
      }
      const documentos: Partial<Record<DocId, string>> = {};
      for (const d of DOC_FIELDS) {
        const file = docs[d.id];
        if (file) documentos[d.id] = await fileToDataUrl(file);
      }
      await adminApi.crearCadete({
        ...form,
        direccion_parts: {
          ...form.direccion_parts,
          piso_dpto: form.direccion_parts.piso_dpto || null,
        },
        documentos,
      });
      setOpen(false);
      setForm(emptyForm);
      setDocs({});
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  if (error && !items) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  const markers = items
    .filter((c) => c.ubicacion_actual)
    .map((c) => ({
      id: c.usuario_id,
      lat: c.ubicacion_actual!.lat,
      lng: c.ubicacion_actual!.lng,
      label: fleetMarkerLabel(
        c.nombre ?? c.dni,
        c.disponibilidad,
        c.ubicacion_actualizada_en,
        now,
      ),
      color: fleetMarkerColor(c.disponibilidad, c.ubicacion_actualizada_en, now),
    }));

  const liveHint =
    socketStatus === 'live'
      ? 'Flota en vivo'
      : socketStatus === 'connecting'
        ? 'Conectando mapa…'
        : 'Mapa sin socket (última posición)';

  return (
    <div className="page-enter">
      <PageHeader
        title="Cadetes"
        subtitle={`Alta con dirección y PDFs · aprobar, suspender y monitorear flota · ${liveHint}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={load}>
              Actualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              Nuevo cadete
            </button>
          </div>
        }
      />
      {error ? <ErrorBox message={error} /> : null}

      <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <MapView markers={markers} />
        <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
          Verde online · naranja en viaje · gris GPS &gt;5 min o offline
        </p>
      </div>

      <div className="panel table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Nombre</th>
              <th>Dirección</th>
              <th>DNI</th>
              <th>Patente</th>
              <th>Docs</th>
              <th>Verificación</th>
              <th>Cuenta</th>
              <th>Disponibilidad</th>
              <th>Plan</th>
              <th>CBU</th>
              <th>Viajes</th>
              <th>Ganado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const links = docsLinks(c);
              const isBusy = busy === c.usuario_id;
              const inactivo = c.estado === 'inactivo';
              return (
                <tr key={c.usuario_id}>
                  <td className="mono">
                    <strong>{c.numero_usuario}</strong>
                  </td>
                  <td>
                    <strong>{c.nombre ?? '—'}</strong>
                    <div className="muted mono">{c.email}</div>
                  </td>
                  <td style={{ maxWidth: 180, fontSize: 12 }}>
                    {formatDireccionParts(c)}
                    {c.barrio ? (
                      <div className="muted">Zona: {c.barrio}</div>
                    ) : null}
                  </td>
                  <td className="mono">{c.dni}</td>
                  <td className="mono">{c.patente}</td>
                  <td style={{ fontSize: 12 }}>
                    {links.length === 0 ? (
                      <span className="muted">Sin PDF</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {links.map((l) => (
                          <a
                            key={l.label}
                            href={l.href}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            {l.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <Badge tone={toneVerif(c.estado_verificacion)}>
                      {c.estado_verificacion}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={estadoBadgeTone(c.estado)}>
                      {c.estado ?? 'activo'}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={c.disponibilidad === 'online' ? 'ok' : 'neutral'}>
                      {c.disponibilidad}
                    </Badge>
                  </td>
                  <td>
                    {c.plan_suscripcion}
                    <div className="muted" style={{ fontSize: 12 }}>
                      Comisión {c.comision_actual}%
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {c.cbu ? (
                      <>
                        <div>{c.banco ?? 'Banco'}</div>
                        <div>{c.cbu}</div>
                      </>
                    ) : (
                      <span className="muted">Sin CBU</span>
                    )}
                  </td>
                  <td>{c.total_viajes}</td>
                  <td>
                    <Money value={c.total_ganado} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={isBusy}
                        onClick={() => openEdit(c)}
                      >
                        Editar
                      </button>
                      {!inactivo ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={isBusy}
                          onClick={() => void bajaCadete(c)}
                        >
                          Dar de baja
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={isBusy}
                          onClick={() => void reactivarCadete(c)}
                        >
                          Reactivar
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isBusy}
                        onClick={() => void action(c.usuario_id, 'aprobado')}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={isBusy}
                        onClick={() => void action(c.usuario_id, 'suspendido')}
                      >
                        Suspender
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={14} className="muted">
                  Sin cadetes — usá “Nuevo cadete”
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editOpen && editTarget ? (
        <div className="modal-backdrop" onClick={() => !editSaving && setEditOpen(false)}>
          <form
            className="modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void onEditSubmit(e)}
          >
            <h2>Editar cadete · {editTarget.nombre ?? editTarget.dni}</h2>
            {editError ? <ErrorBox message={editError} /> : null}
            <div className="form-grid">
              <div className="field full">
                <label>Nombre</label>
                <input
                  required
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                />
              </div>
              <div className="field full">
                <label>Email</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input
                  required
                  value={editForm.telefono}
                  onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                />
              </div>
              <div className="field">
                <label>DNI (número)</label>
                <input
                  required
                  minLength={7}
                  value={editForm.dni}
                  onChange={(e) => setEditForm({ ...editForm, dni: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Nº carnet / licencia</label>
                <input
                  required
                  minLength={3}
                  value={editForm.licencia}
                  onChange={(e) => setEditForm({ ...editForm, licencia: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Patente</label>
                <input
                  required
                  minLength={5}
                  value={editForm.patente}
                  onChange={(e) =>
                    setEditForm({ ...editForm, patente: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="field">
                <label>Marca moto</label>
                <input
                  value={editForm.marca_moto}
                  onChange={(e) => setEditForm({ ...editForm, marca_moto: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Plan</label>
                <select
                  value={editForm.plan_suscripcion}
                  onChange={(e) =>
                    setEditForm({ ...editForm, plan_suscripcion: e.target.value })
                  }
                >
                  {PLANES_CADETE.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={editSaving}
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={editSaving}>
                {editSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {open ? (
        <div className="modal-backdrop" onClick={() => !saving && setOpen(false)}>
          <form
            className="modal"
            style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void onSubmit(e)}
          >
            <h2>Nuevo cadete</h2>
            <p className="modal-sub">
              Dirección obligatoria. Podés adjuntar PDF (o imagen) de DNI, carnet, seguro, AFIP y
              Rentas.
            </p>
            {formError ? <ErrorBox message={formError} /> : null}
            <div className="form-grid">
              <div className="field full">
                <label>Nombre</label>
                <input
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="field full">
                <strong style={{ display: 'block', marginBottom: 8 }}>Domicilio</strong>
                <div className="form-grid">
                  <div className="field" style={{ gridColumn: 'span 2' }}>
                    <label>Calle / dirección</label>
                    <input
                      required
                      value={form.direccion_parts.calle}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          direccion_parts: { ...form.direccion_parts, calle: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Número</label>
                    <input
                      required
                      value={form.direccion_parts.numero}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          direccion_parts: { ...form.direccion_parts, numero: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Piso / dpto</label>
                    <input
                      value={form.direccion_parts.piso_dpto}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          direccion_parts: { ...form.direccion_parts, piso_dpto: e.target.value },
                        })
                      }
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="field">
                    <label>Barrio</label>
                    <input
                      required
                      list="barrios-salta"
                      value={form.direccion_parts.barrio}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          direccion_parts: { ...form.direccion_parts, barrio: e.target.value },
                        })
                      }
                      placeholder="Define la zona"
                    />
                  </div>
                  <div className="field">
                    <label>Ciudad</label>
                    <input
                      required
                      value={form.direccion_parts.ciudad}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          direccion_parts: { ...form.direccion_parts, ciudad: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Provincia</label>
                    <input
                      required
                      value={form.direccion_parts.provincia}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          direccion_parts: { ...form.direccion_parts, provincia: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
                <datalist id="barrios-salta">
                  <option value="Centro Cívico" />
                  <option value="Shopping" />
                  <option value="Tres Cerritos" />
                  <option value="Grand Bourg" />
                  <option value="Límite Sur" />
                  <option value="Aeropuerto" />
                </datalist>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Se arma: {formatDireccionParts(form.direccion_parts)} · la zona sale del barrio
                </p>
              </div>
              <div className="field full">
                <label>Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input
                  required
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="field">
                <label>DNI (número)</label>
                <input
                  required
                  minLength={7}
                  value={form.dni}
                  onChange={(e) => setForm({ ...form, dni: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Nº carnet / licencia</label>
                <input
                  required
                  minLength={3}
                  value={form.licencia}
                  onChange={(e) => setForm({ ...form, licencia: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Patente</label>
                <input
                  required
                  minLength={5}
                  value={form.patente}
                  onChange={(e) => setForm({ ...form, patente: e.target.value.toUpperCase() })}
                  placeholder="ABC123"
                />
              </div>
              <div className="field">
                <label>Marca moto</label>
                <input
                  value={form.marca_moto}
                  onChange={(e) => setForm({ ...form, marca_moto: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Nacimiento</label>
                <input
                  required
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
                />
              </div>

              <div className="field full">
                <strong style={{ display: 'block', marginBottom: 8 }}>Documentos (PDF)</strong>
                <div className="form-grid">
                  {DOC_FIELDS.map((d) => (
                    <div className="field" key={d.id}>
                      <label htmlFor={`doc-${d.id}`}>{d.label}</label>
                      <input
                        id={`doc-${d.id}`}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setDocs((prev) => ({ ...prev, [d.id]: file }));
                        }}
                      />
                      {docs[d.id] ? (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {docs[d.id]!.name}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="field full">
                <label>
                  <input
                    type="checkbox"
                    checked={form.aprobar}
                    onChange={(e) => setForm({ ...form, aprobar: e.target.checked })}
                  />{' '}
                  Aprobar automáticamente
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Crear cadete'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
