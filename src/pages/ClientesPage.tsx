import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';
import { emptyDireccionParts, formatDireccionParts } from '../lib/direccion';
import {
  esNegocio,
  PERFILES_CUENTA,
  TIPOS_NEGOCIO,
  type TipoCuentaCliente,
} from '../lib/perfilesCuenta';
import type { ClienteAdmin, ClienteDetalleAdmin } from '../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../components/ui';

function makeEmptyForm(ambito: 'usuario' | 'negocio') {
  const tipo: TipoCuentaCliente = ambito === 'negocio' ? 'restaurante' : 'particular';
  return {
    nombre: '',
    email: '',
    telefono: '',
    dni: '',
    direccion_parts: emptyDireccionParts(),
    password: '',
    plan_suscripcion: 'gratuito',
    tipo_cuenta: tipo,
    tiempo_preparacion_min: PERFILES_CUENTA[tipo].prep_default_min,
    horario_abre: '09:00',
    horario_cierra: '22:00',
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

/** Cliente = Usuario | Negocio. Esta página filtra por ámbito. */
export function ClientesPage({ ambito = 'usuario' }: { ambito?: 'usuario' | 'negocio' }) {
  const esAmbitoNegocio = ambito === 'negocio';
  const [items, setItems] = useState<ClienteAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => makeEmptyForm(ambito));
  const [dniFile, setDniFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ClienteDetalleAdmin | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  useEffect(() => {
    setForm(makeEmptyForm(ambito));
    setDetalle(null);
    setQ('');
  }, [ambito]);

  const load = useCallback(() => {
    setError(null);
    adminApi
      .clientes()
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      if (!dniFile) throw new Error('Adjuntá el PDF o foto del DNI para validar identidad');
      const documento_dni = await fileToDataUrl(dniFile);
      const tipo: TipoCuentaCliente = esAmbitoNegocio
        ? form.tipo_cuenta === 'comercio'
          ? 'comercio'
          : 'restaurante'
        : 'particular';
      const perfil = PERFILES_CUENTA[tipo];
      const prep = esAmbitoNegocio
        ? form.tiempo_preparacion_min || perfil.prep_default_min
        : 0;
      await adminApi.crearCliente({
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
        dni: form.dni,
        password: form.password,
        plan_suscripcion: form.plan_suscripcion,
        tipo_cuenta: tipo,
        tiempo_preparacion_min: prep,
        horario_comercial: esAmbitoNegocio
          ? { abre: form.horario_abre, cierra: form.horario_cierra }
          : null,
        direccion_parts: {
          ...form.direccion_parts,
          piso_dpto: form.direccion_parts.piso_dpto || null,
        },
        documento_dni,
      });
      setOpen(false);
      setForm(makeEmptyForm(ambito));
      setDniFile(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  const scoped = useMemo(() => {
    if (!items) return [];
    return items.filter((c) => {
      const negocio = esNegocio(c.tipo_cuenta);
      return esAmbitoNegocio ? negocio : !negocio;
    });
  }, [items, esAmbitoNegocio]);

  if (error && !items) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  const filtered = scoped.filter((c) => {
    const s = q.toLowerCase();
    const tipoLabel = PERFILES_CUENTA[c.tipo_cuenta ?? 'particular']?.label ?? '';
    return (
      !s ||
      c.nombre.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      c.telefono.includes(s) ||
      c.dni?.includes(s) ||
      tipoLabel.toLowerCase().includes(s) ||
      formatDireccionParts(c).toLowerCase().includes(s) ||
      (c.barrio ?? '').toLowerCase().includes(s) ||
      String(c.numero_usuario ?? '').includes(s)
    );
  });

  const title = esAmbitoNegocio ? 'Negocios' : 'Usuarios';
  const subtitle = esAmbitoNegocio
    ? 'Restaurantes y comercios — tiempos de cocina o armado'
    : 'Personas que piden envíos al momento';
  const ctaNuevo = esAmbitoNegocio ? 'Nuevo negocio' : 'Nuevo usuario';
  const emptyMsg = esAmbitoNegocio
    ? 'Sin negocios — usá “Nuevo negocio”'
    : 'Sin usuarios — usá “Nuevo usuario”';

  return (
    <div className="page-enter">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setForm(makeEmptyForm(ambito));
              setOpen(true);
            }}
          >
            {ctaNuevo}
          </button>
        }
      />
      {error ? <ErrorBox message={error} /> : null}

      <div className="toolbar">
        <div className="field">
          <label htmlFor="q">Buscar</label>
          <input
            id="q"
            placeholder={
              esAmbitoNegocio
                ? 'Nº, restaurante/comercio, nombre, email o dirección'
                : 'Nº, DNI, nombre, email o dirección'
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="panel table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Nº</th>
              <th>{esAmbitoNegocio ? 'Negocio' : 'Usuario'}</th>
              {esAmbitoNegocio ? <th>Tipo</th> : null}
              <th>Dirección</th>
              <th>DNI</th>
              <th>Identidad</th>
              <th>Teléfono</th>
              <th>Plan</th>
              <th>Suscripción</th>
              <th>Viajes</th>
              <th>Pago preferido</th>
              <th>Puntos</th>
              <th>Calif.</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.usuario_id}
                style={{ cursor: 'pointer' }}
                className={detalle?.cliente.usuario_id === c.usuario_id ? 'row-selected' : undefined}
                onClick={() => {
                  setDetalleLoading(true);
                  void adminApi
                    .detalleCliente(c.usuario_id)
                    .then(setDetalle)
                    .catch((e: Error) => setError(e.message))
                    .finally(() => setDetalleLoading(false));
                }}
              >
                <td className="mono">
                  <strong>{c.numero_usuario}</strong>
                </td>
                <td>
                  <strong>{c.nombre}</strong>
                  <div className="muted mono">{c.email}</div>
                </td>
                {esAmbitoNegocio ? (
                  <td>
                    <Badge tone={c.tipo_cuenta === 'restaurante' ? 'warn' : 'neutral'}>
                      {PERFILES_CUENTA[c.tipo_cuenta ?? 'comercio'].label}
                    </Badge>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      Prep. {c.tiempo_preparacion_min ?? 0} min
                    </div>
                  </td>
                ) : null}
                <td style={{ maxWidth: 180, fontSize: 12 }}>
                  {formatDireccionParts(c)}
                  {c.zona_nombre || c.barrio ? (
                    <div className="muted">Zona: {c.zona_nombre ?? c.barrio}</div>
                  ) : null}
                </td>
                <td className="mono">{c.dni}</td>
                <td>
                  {c.fotos_documentos?.dni_pdf ? (
                    <a
                      href={c.fotos_documentos.dni_pdf}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Ver DNI
                    </a>
                  ) : (
                    <span className="muted">Sin PDF</span>
                  )}
                </td>
                <td>{c.telefono}</td>
                <td>{c.plan_suscripcion}</td>
                <td>
                  <Badge tone={c.estado_suscripcion === 'activa' ? 'ok' : 'warn'}>
                    {c.estado_suscripcion}
                  </Badge>
                </td>
                <td>{c.viajes_realizados}</td>
                <td>{c.metodo_pago_preferido ?? '—'}</td>
                <td>{c.puntos_fidelidad}</td>
                <td>{Number(c.calificacion_promedio).toFixed(1)}</td>
                <td>
                  <Badge tone={c.estado === 'activo' ? 'ok' : 'neutral'}>{c.estado}</Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={esAmbitoNegocio ? 14 : 13} className="muted">
                  {emptyMsg}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detalleLoading ? <Loading /> : null}
      {detalle ? (
        <div className="panel panel-pad" style={{ marginTop: '1rem' }}>
          <div className="panel-head">
            <h3>Ficha · {detalle.cliente.nombre}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetalle(null)}>
              Cerrar
            </button>
          </div>
          <p className="muted">
            {esNegocio(detalle.cliente.tipo_cuenta) ? (
              <>
                Negocio:{' '}
                <strong>
                  {PERFILES_CUENTA[detalle.cliente.tipo_cuenta ?? 'comercio'].label}
                </strong>
                {' · '}
                Prep. default: <strong>{detalle.cliente.tiempo_preparacion_min ?? 0} min</strong>
              </>
            ) : (
              <>
                Tipo: <strong>Usuario</strong>
              </>
            )}
            {' · '}
            Dirección: <strong>{formatDireccionParts(detalle.cliente)}</strong>
            {detalle.cliente.zona_nombre ? (
              <>
                {' · '}
                Zona: <strong>{detalle.cliente.zona_nombre}</strong>
              </>
            ) : null}
            {' · '}
            Pago preferido: <strong>{detalle.cliente.metodo_pago_preferido}</strong>
            {detalle.cliente.fotos_documentos?.dni_pdf ? (
              <>
                {' · '}
                <a
                  href={detalle.cliente.fotos_documentos.dni_pdf}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver DNI
                </a>
              </>
            ) : null}
          </p>
          <div className="kpi-spotlight" style={{ marginBottom: '1rem' }}>
            <div className="kpi">
              <div className="label">Viajes</div>
              <div className="value">{detalle.stats.viajes_total}</div>
              <div className="kpi-hint">
                {detalle.stats.viajes_finalizados} ok · {detalle.stats.viajes_cancelados} cancel.
              </div>
            </div>
            <div className="kpi">
              <div className="label">Importe pagado</div>
              <div className="value">
                <Money value={detalle.stats.importe_pagado} />
              </div>
            </div>
            <div className="kpi">
              <div className="label">Ticket promedio</div>
              <div className="value">
                <Money value={detalle.stats.ticket_promedio} />
              </div>
            </div>
          </div>
          <div className="grid-2">
            <div>
              <h4>Por método de pago</h4>
              <table className="data">
                <thead>
                  <tr>
                    <th>Método</th>
                    <th>Viajes</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.por_metodo.map((m) => (
                    <tr key={m.metodo_pago}>
                      <td>{m.metodo_pago}</td>
                      <td>{m.viajes}</td>
                      <td>
                        <Money value={m.monto} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4>Últimos viajes</h4>
              <table className="data">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Destino</th>
                    <th>Pago</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.viajes_recientes.map((v) => (
                    <tr key={v.id}>
                      <td className="mono">
                        {new Date(v.fecha_solicitud).toLocaleString('es-AR')}
                      </td>
                      <td>{v.destino_direccion}</td>
                      <td>
                        {v.metodo_pago} / {v.estado}
                      </td>
                      <td>
                        {v.tarifa_final != null ? <Money value={v.tarifa_final} /> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="modal-backdrop" onClick={() => !saving && setOpen(false)}>
          <form
            className="modal"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void onSubmit(e)}
          >
            <h2>{esAmbitoNegocio ? 'Nuevo negocio' : 'Nuevo usuario'}</h2>
            <p className="modal-sub">
              {esAmbitoNegocio
                ? 'Un negocio puede ser restaurante o comercio — define tiempos de prep. y horario.'
                : 'Usuario persona: pide cadete al momento (sin tiempo de cocina/armado).'}
            </p>
            {formError ? <ErrorBox message={formError} /> : null}
            <div className="form-grid">
              {esAmbitoNegocio ? (
                <>
                  <div className="field full">
                    <label>Tipo de negocio</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {TIPOS_NEGOCIO.map((t) => {
                        const p = PERFILES_CUENTA[t];
                        const on = form.tipo_cuenta === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`btn ${on ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                            onClick={() =>
                              setForm({
                                ...form,
                                tipo_cuenta: t,
                                tiempo_preparacion_min: p.prep_default_min,
                              })
                            }
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {
                        PERFILES_CUENTA[
                          form.tipo_cuenta === 'comercio' ? 'comercio' : 'restaurante'
                        ].descripcion
                      }
                    </p>
                  </div>
                  <div className="field">
                    <label>
                      {form.tipo_cuenta === 'comercio'
                        ? 'Minutos de armado (default)'
                        : 'Minutos de cocina (default)'}
                    </label>
                    <input
                      type="number"
                      min={
                        PERFILES_CUENTA[
                          form.tipo_cuenta === 'comercio' ? 'comercio' : 'restaurante'
                        ].prep_min
                      }
                      max={
                        PERFILES_CUENTA[
                          form.tipo_cuenta === 'comercio' ? 'comercio' : 'restaurante'
                        ].prep_max
                      }
                      value={form.tiempo_preparacion_min}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          tiempo_preparacion_min: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Horario abre</label>
                    <input
                      type="time"
                      value={form.horario_abre}
                      onChange={(e) => setForm({ ...form, horario_abre: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Horario cierra</label>
                    <input
                      type="time"
                      value={form.horario_cierra}
                      onChange={(e) => setForm({ ...form, horario_cierra: e.target.value })}
                    />
                  </div>
                </>
              ) : null}
              <div className="field full">
                <label>{esAmbitoNegocio ? 'Nombre del local' : 'Nombre'}</label>
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
                      list="barrios-salta-cli"
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
                <datalist id="barrios-salta-cli">
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
                <label>Teléfono</label>
                <input
                  required
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="+549387..."
                />
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
                <label>Plan</label>
                <select
                  value={form.plan_suscripcion}
                  onChange={(e) => setForm({ ...form, plan_suscripcion: e.target.value })}
                >
                  <option value="gratuito">Gratuito</option>
                  <option value="basico">Básico</option>
                  <option value="plus">Plus</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div className="field full">
                <label htmlFor="cliente-dni-pdf">DNI — PDF o foto (identidad)</label>
                <input
                  id="cliente-dni-pdf"
                  required
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setDniFile(e.target.files?.[0] ?? null)}
                />
                {dniFile ? (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {dniFile.name}
                  </span>
                ) : null}
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
                {saving ? 'Guardando…' : esAmbitoNegocio ? 'Crear negocio' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
