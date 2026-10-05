/**
 * DATOS ESTRUCTURADOS (JSON-LD) - funciones puras, sin DOM.
 * Se usan en dos lugares con el MISMO código:
 *   - scripts/build.mjs  -> JSON-LD estático dentro del HTML (lo leen todos los rastreadores)
 *   - SeoController      -> actualiza el JSON-LD cuando llegan datos nuevos de Supabase
 * Regla: solo se incluye lo que existe. Nunca se inventan datos.
 */
import { safeUrl } from "../utils/dom.js";

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v != null && !(Array.isArray(v) && !v.length)));

const abs = (siteUrl, path) => (siteUrl ? `${siteUrl}${path}` : undefined);

export function buildBusinessSchema({ negocio, categorias, siteUrl = "" }) {
  const n = negocio;
  const phone = String(n.whatsapp ?? "").replace(/\D/g, "");

  const address = clean({
    "@type": "PostalAddress",
    streetAddress: n.direccion,
    addressLocality: n.ciudad,
    addressCountry: "CO"
  });
  const hasRealAddress = Boolean(n.direccion || n.ciudad);

  const hours = n.horarioSEO?.dias?.length
    ? { "@type": "OpeningHoursSpecification", dayOfWeek: n.horarioSEO.dias, opens: n.horarioSEO.abre, closes: n.horarioSEO.cierra }
    : undefined;

  const offers = (categorias ?? []).map((cat) => {
    const min = Math.min(...cat.servicios.map((s) => Number(s.precio) || 0));
    return {
      "@type": "Offer",
      itemOffered: clean({ "@type": "Service", name: cat.tarjeta?.titulo ?? cat.id, description: cat.tarjeta?.descripcion }),
      priceSpecification: { "@type": "PriceSpecification", minPrice: min, priceCurrency: n.moneda ?? "COP" }
    };
  });

  const sameAs = [n.redes?.instagram, n.redes?.facebook, n.redes?.tiktok, n.perfilGoogle].map(safeUrl).filter(Boolean);

  const business = clean({
    "@type": "LocalBusiness",
    "@id": abs(siteUrl, "/#negocio") ?? "#negocio",
    name: n.nombre ?? "Animal Friends",
    description: n.descripcionFooter,
    url: abs(siteUrl, "/"),
    image: abs(siteUrl, "/assets/img/og-cover.jpg"),
    logo: abs(siteUrl, "/assets/img/logo-icon.webp"),
    telephone: phone ? `+${phone}` : undefined,
    email: n.correo,
    address: hasRealAddress ? address : undefined,
    openingHoursSpecification: hours,
    hasMap: safeUrl(n.perfilGoogle) || undefined,
    sameAs,
    hasOfferCatalog: offers.length ? { "@type": "OfferCatalog", name: "Servicios", itemListElement: offers } : undefined
  });

  const website = clean({
    "@type": "WebSite",
    "@id": abs(siteUrl, "/#sitio") ?? "#sitio",
    url: abs(siteUrl, "/"),
    name: n.nombre ?? "Animal Friends",
    inLanguage: "es-CO",
    publisher: { "@id": business["@id"] }
  });

  return { "@context": "https://schema.org", "@graph": [business, website] };
}

/** Página interna (p. ej. páginas legales): WebPage + migas de pan. */
export function buildPageSchema({ siteUrl, path, name, description }) {
  if (!siteUrl) return null;
  const url = `${siteUrl}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      clean({ "@type": "WebPage", "@id": `${url}#pagina`, url, name, description, inLanguage: "es-CO", isPartOf: { "@id": `${siteUrl}/#sitio` } }),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name, item: url }
        ]
      }
    ]
  };
}
