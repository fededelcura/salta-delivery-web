import { Link } from 'react-router-dom';
import './landing.css';

export function LandingPage() {
  return (
    <div className="lp">
      <div className="lp-topbar">
        <div className="lp-topbar-inner">
          <span>Salta Capital · Envíos en moto</span>
          <span className="lp-topbar-sep" aria-hidden />
          <a href="tel:+543874000000">+54 387 400-0000</a>
          <span className="lp-topbar-sep" aria-hidden />
          <a href="mailto:hola@saltadelivery.com">hola@saltadelivery.com</a>
        </div>
      </div>

      <section className="lp-hero" id="inicio">
        <div className="lp-hero-media" aria-hidden="true">
          <img src="/hero-salta.jpg" alt="" />
        </div>
        <div className="lp-hero-scrim" aria-hidden="true" />

        <header className="lp-nav">
          <a className="lp-logo" href="#inicio">
            Salta Delivery
          </a>
          <nav className="lp-links" aria-label="Principal">
            <a href="#como">Cómo funciona</a>
            <a href="#cobertura">Cobertura</a>
            <Link className="lp-nav-cta" to="/pedir">
              Pedir
            </Link>
          </nav>
        </header>

        <div className="lp-hero-copy">
          <p className="lp-brand-mark">Salta Delivery</p>
          <h1 className="lp-headline">
            Rápido<span className="dot d1">.</span> Cercano
            <span className="dot d2">.</span> Confiable
            <span className="dot d3">.</span>
          </h1>
          <p className="lp-lead">
            Cadetes en moto por toda Salta. Pedí un envío en minutos y seguí el viaje en vivo.
          </p>
          <div className="lp-cta">
            <Link className="lp-btn lp-btn-primary" to="/pedir">
              Pedir ahora
            </Link>
            <Link className="lp-btn lp-btn-accent" to="/login">
              Acceso admin
            </Link>
          </div>
        </div>
      </section>

      <main>
        <section className="lp-section" id="como">
          <h2>Cómo funciona</h2>
          <p className="lp-section-lead">
            Tres pasos. Sin fricción. Pensado para clientes y cadetes.
          </p>
          <ol className="lp-steps">
            <li>
              <span className="lp-step-n">01</span>
              <strong>Pedís</strong>
              <span>Origen, destino y listo.</span>
            </li>
            <li>
              <span className="lp-step-n">02</span>
              <strong>Asignamos</strong>
              <span>El cadete más cerca toma el viaje.</span>
            </li>
            <li>
              <span className="lp-step-n">03</span>
              <strong>Seguís</strong>
              <span>Tracking en vivo hasta la entrega.</span>
            </li>
          </ol>
        </section>

        <section className="lp-section lp-section-alt" id="cobertura">
          <h2>Salta, de punta a punta</h2>
          <p className="lp-section-lead">
            Zonas hexagonales, matching inteligente y cadetes verificados.
          </p>
          <div className="lp-strip">
            <div>
              <strong>Minutos</strong>
              <span>Matching por distancia y rating</span>
            </div>
            <div>
              <strong>Suscripción</strong>
              <span>Planes para clientes y cadetes</span>
            </div>
            <div>
              <strong>Comisión justa</strong>
              <span>Menos % cuanto mejor el plan</span>
            </div>
          </div>
        </section>

        <section className="lp-finale">
          <h2>Listo para mover Salta</h2>
          <p>Panel operativo para tu flota, tus clientes y tus viajes.</p>
          <Link className="lp-btn lp-btn-light" to="/pedir">
            Pedir un envío
          </Link>
        </section>
      </main>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} Salta Delivery</span>
        <a href="mailto:hola@saltadelivery.com">Contacto</a>
      </footer>
    </div>
  );
}
