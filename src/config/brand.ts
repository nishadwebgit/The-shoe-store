/**
 * Brand configuration. Change the store identity here; components read from this object
 * instead of hard-coding names, contact details or social links.
 */
export const brand = {
  name: 'Nishoes',
  legalName: 'Nishoes Footwear (Pvt) Ltd',
  tagline: 'Shoes for the way Sri Lanka moves',
  shortDescription:
    'A Colombo footwear store stocking Nike, adidas, New Balance, ASICS, Vans and more, plus our own Nishoes label.',
  email: 'hello@nishoes.lk',
  supportEmail: 'care@nishoes.lk',
  phone: '+94 11 234 5678',
  whatsapp: '+94 77 123 4567',
  address: '42 Ward Place, Colombo 07, Sri Lanka',
  hours: 'Mon–Sat, 9.00 am – 7.00 pm',
  social: [
    { label: 'Instagram', href: 'https://www.instagram.com/' },
    { label: 'Facebook', href: 'https://www.facebook.com/' },
    { label: 'TikTok', href: 'https://www.tiktok.com/' },
    { label: 'YouTube', href: 'https://www.youtube.com/' },
  ],
} as const;
