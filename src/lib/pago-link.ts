/** URL pública del link de pago del envío (prod usa HashRouter). */
export function linkPagoEnvio(token: string): string {
  const { origin, pathname } = window.location;
  return import.meta.env.PROD ? `${origin}${pathname}#/pagar/${token}` : `${origin}/pagar/${token}`;
}

export function whatsappPagoUrl(telefono: string, link: string, negocio?: string): string {
  const digits = telefono.replace(/\D/g, '');
  const intl = digits.startsWith('54') ? digits : `549${digits.replace(/^0/, '')}`;
  const texto = `Hola! Tu pedido${negocio ? ` de ${negocio}` : ''} está en camino con Salta Delivery. Pagá el envío acá: ${link}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(texto)}`;
}
