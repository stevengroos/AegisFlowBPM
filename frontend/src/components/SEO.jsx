import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function SEO({ title, description, image, url }) {
  // Si no pasas una imagen, usará una por defecto (asegúrate de crear una en el futuro)
  const defaultImage = image || "https://tu-dominio.com/aegisflow-social-preview.jpg";

  return (
    <Helmet>
      {/* Etiquetas Básicas */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Etiquetas Open Graph (Facebook, LinkedIn, WhatsApp) */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={defaultImage} />

      {/* Etiquetas Twitter / X */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={defaultImage} />
    </Helmet>
  );
}