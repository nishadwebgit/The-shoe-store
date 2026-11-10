import type { Category, Review } from '../types';
import { unsplashPhoto } from '../utils/images';
import { hashString, seededRandom } from '../utils/random';

/** MOCK MODE ONLY: categories and sample reviews. In API mode these come from SQL Server. */

export const categories: Category[] = [
  {
    id: 'running', label: 'Running', description: 'Road shoes, daily trainers and race-day plates',
    query: { category: 'running' }, image: /* @__PURE__ */ unsplashPhoto('1542291026-7eec264c27ff', 640),
  },
  {
    id: 'lifestyle', label: 'Lifestyle', description: 'Court classics and everyday sneakers',
    query: { category: 'lifestyle' }, image: /* @__PURE__ */ unsplashPhoto('1600269452121-4f2416e55c28', 640),
  },
  {
    id: 'trail', label: 'Trail & hiking', description: 'Grip for hill-country mud and rock',
    query: { category: 'trail' }, image: /* @__PURE__ */ unsplashPhoto('1760465809553-ddcbe4bb4753', 640),
  },
  {
    id: 'sports', label: 'Sports & training', description: 'Gym, court and field',
    query: { category: 'sports' }, image: /* @__PURE__ */ unsplashPhoto('1606107557195-0e29a4b5b4aa', 640),
  },
  {
    id: 'kids', label: 'Kids', description: 'Easy-on shoes for school and play',
    query: { gender: 'kids' }, image: /* @__PURE__ */ unsplashPhoto('1605382165091-443eff32caf5', 640),
  },
  {
    id: 'sandals', label: 'Sandals', description: 'Quick-dry pairs for beach and monsoon',
    query: { category: 'sandals' }, image: /* @__PURE__ */ unsplashPhoto('1603487742131-4160ec999306', 640),
  },
  {
    id: 'formal', label: 'Formal & loafers', description: 'Loafers and Chelsea boots in leather',
    query: { category: 'formal' }, image: /* @__PURE__ */ unsplashPhoto('1616406432452-07bc5938759d', 640),
  },
  {
    id: 'boots', label: 'Boots', description: 'Dr. Martens, Timberland and leather boots',
    query: { category: 'boots' }, image: /* @__PURE__ */ unsplashPhoto('1481729379561-01e43a3e1ed4', 640),
  },
];

const reviewers = [
  ['Dilini P.', 'Colombo'], ['Ashan W.', 'Kandy'], ['Mohamed R.', 'Negombo'], ['Tharushi F.', 'Galle'],
  ['Kasun J.', 'Kurunegala'], ['Nimali S.', 'Matara'], ['Ravindu K.', 'Jaffna'], ['Shehani D.', 'Nuwara Eliya'],
  ['Pradeep A.', 'Ratnapura'], ['Fathima Z.', 'Batticaloa'],
];

const reviewTemplates: { title: string; body: string; rating: number }[] = [
  { title: 'Comfortable straight out of the box', body: 'No break-in at all. I wore them for a full day of walking around Pettah and my feet were fine.', rating: 5 },
  { title: 'Great for the humidity', body: 'They breathe well, which matters in Colombo. They dry quickly after getting caught in the rain too.', rating: 5 },
  { title: 'Good quality, sizing a little off', body: 'Well made and good looking. I had to exchange for a different size, but the exchange was quick and free.', rating: 4 },
  { title: 'Looks even better in person', body: 'The colour is richer than the photos. I get compliments every time I wear them.', rating: 5 },
  { title: 'Solid everyday pair', body: 'Does exactly what I need. The sole has some grip on wet tiles, which surprised me.', rating: 4 },
  { title: 'Decent, but expected more cushioning', body: 'Fine for short walks. On longer days I noticed the cushioning is on the firmer side.', rating: 3 },
  { title: 'Fast delivery to Kandy', body: 'Arrived in two days, well packed. The shoes are lightweight and fit as expected.', rating: 5 },
  { title: 'My go-to pair now', body: 'I bought a second colour after a month. Easy to clean and they still look new.', rating: 5 },
];

/** Deterministic sample reviews for a product. */
export function sampleReviews(productId: string, sizes: string[], averageRating: number): Review[] {
  const rand = seededRandom(hashString(`reviews-${productId}`));
  const count = 6;
  const fits: Review['fit'][] = ['true', 'true', 'true', 'small', 'large'];
  return Array.from({ length: count }, (_, i) => {
    let template = reviewTemplates[Math.floor(rand() * reviewTemplates.length)];
    if (averageRating >= 4.7 && template.rating < 4) template = reviewTemplates[0];
    const [author, location] = reviewers[Math.floor(rand() * reviewers.length)];
    const daysAgo = 3 + Math.floor(rand() * 240);
    return {
      id: `${productId}-r${i}`,
      productId,
      author,
      location,
      rating: template.rating,
      title: template.title,
      body: template.body,
      fit: fits[Math.floor(rand() * fits.length)],
      sizePurchased: sizes[Math.floor(rand() * sizes.length)],
      createdAt: new Date(Date.UTC(2026, 10, 1) - daysAgo * 86400000).toISOString(),
      verified: rand() > 0.15,
    };
  });
}

