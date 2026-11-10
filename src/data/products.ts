import type { Gender, Product, Silhouette, SizeSystem, StyleCategory, Variant } from '../types';
import { categoryLabels } from './labels';
import { photoGallery } from '../utils/images';
import { hashString, seededRandom } from '../utils/random';
import { colourFamilies } from './colours';

/**
 * Mock product catalogue (used only when VITE_USE_MOCK_SERVICES=true).
 *
 * Products are real brand models photographed in free-to-use Unsplash photos. Each colourway
 * points at a photo of that exact shoe, so names and colours match the pictures. Shoes with no
 * visible brand in their photo are listed under the store's own Nishoes label.
 *
 * Seeds are expanded into the full `Product` shape the future API will return (variants with
 * per-size stock, a gallery per colourway, specifications). Generation is deterministic, so
 * stock levels stay the same across reloads.
 */

interface ColourSeed {
  id: string;
  name: string;
  swatch: string;
  /** Key of `colourFamilies`, used by the colour filter. */
  family: keyof typeof colourFamilies;
  /** Unsplash photo id of this colourway. */
  photo: string;
}

interface ProductSeed {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  categories: StyleCategory[];
  /** Shoe type, used for materials/care copy and closure. */
  silhouette: Silhouette;
  price: number;
  originalPrice?: number;
  colours: ColourSeed[];
  description: string;
  highlights: string[];
  rating: number;
  reviewCount: number;
  fit?: Product['fit'];
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  releasedAt: string;
  popularity: number;
  /** Force every variant out of stock (to demo unavailable products). */
  soldOut?: boolean;
}

const seeds: ProductSeed[] = [
  // ---------------------------------------------------------------- Nike & Jordan
  {
    id: 'P001', name: 'Nike Air Force 1 ’07', brand: 'Nike', gender: 'unisex', categories: ['lifestyle', 'casual'],
    silhouette: 'court', price: 34900,
    colours: [
      { id: 'white', name: 'White', swatch: '#f4f4f2', family: 'white', photo: '1600269452121-4f2416e55c28' },
      { id: 'black', name: 'Black / White', swatch: '#1b1d22', family: 'black', photo: '1543508282-6319a3e2621f' },
      { id: 'brown', name: 'Brown Canvas', swatch: '#b9844b', family: 'brown', photo: '1549298916-b41d501d3772' },
    ],
    description: 'The basketball shoe that became an everyday staple. A stitched leather upper, a chunky cupsole with Air cushioning, and a shape that works with almost anything you wear.',
    highlights: ['Leather upper', 'Air-Sole cushioning in the heel', 'Pivot-circle rubber outsole'],
    rating: 4.8, reviewCount: 412, featured: true, bestSeller: true, releasedAt: '2025-02-10', popularity: 99,
  },
  {
    id: 'P002', name: 'Nike Air Force 1 High', brand: 'Nike', gender: 'unisex', categories: ['lifestyle', 'casual'],
    silhouette: 'hightop', price: 39900,
    colours: [{ id: 'white', name: 'White', swatch: '#f4f4f2', family: 'white', photo: '1512374382149-233c42b6a83b' }],
    description: 'The high-top Air Force 1, with a padded collar and an adjustable ankle strap for extra hold.',
    highlights: ['Leather upper', 'Hook-and-loop ankle strap', 'Air-Sole cushioning'],
    rating: 4.6, reviewCount: 118, releasedAt: '2025-06-01', popularity: 72,
  },
  {
    id: 'P003', name: 'Nike Air Force 1 Shadow', brand: 'Nike', gender: 'women', categories: ['lifestyle', 'casual'],
    silhouette: 'court', price: 38900, originalPrice: 42900,
    colours: [{ id: 'pastel', name: 'Pastel Multi', swatch: '#c9b8e6', family: 'purple', photo: '1595950653106-6c9ebd614d3a' }],
    description: 'A playful take on the Air Force 1 with doubled-up overlays, a raised midsole and soft pastel panels.',
    highlights: ['Layered leather and synthetic upper', 'Stacked platform midsole', 'Double branding details'],
    rating: 4.7, reviewCount: 96, releasedAt: '2025-04-15', popularity: 78,
  },
  {
    id: 'P004', name: 'Air Jordan 1 Mid', brand: 'Jordan', gender: 'men', categories: ['lifestyle', 'sports'],
    silhouette: 'hightop', price: 42900,
    colours: [{ id: 'white-red', name: 'White / Black / Red', swatch: '#d33a2c', family: 'red', photo: '1597045566677-8cf032ed6634' }],
    description: 'The mid-height version of the 1985 basketball original, with the Wings logo on the collar and classic colour blocking.',
    highlights: ['Leather and synthetic upper', 'Encapsulated Air in the heel', 'Wings logo on the collar'],
    rating: 4.8, reviewCount: 288, bestSeller: true, featured: true, releasedAt: '2025-09-01', popularity: 97,
  },
  {
    id: 'P005', name: 'Nike Air Max', brand: 'Nike', gender: 'unisex', categories: ['lifestyle', 'running'],
    silhouette: 'runner', price: 44900,
    colours: [{ id: 'white-orange', name: 'White / Orange', swatch: '#ef6a3a', family: 'orange', photo: '1600185365926-3a2ce3cdb9eb' }],
    description: 'Visible Air cushioning in a light, everyday sneaker. Mesh and leather overlays keep it breathable through a humid Colombo afternoon.',
    highlights: ['Visible Air unit in the heel', 'Mesh and leather upper', 'Waffle rubber outsole'],
    rating: 4.6, reviewCount: 164, newArrival: true, releasedAt: '2026-09-20', popularity: 86,
  },
  {
    id: 'P006', name: 'Nike Free Run Flyknit', brand: 'Nike', gender: 'men', categories: ['running', 'sports'],
    silhouette: 'runner', price: 36900,
    colours: [{ id: 'red', name: 'University Red', swatch: '#c8202f', family: 'red', photo: '1542291026-7eec264c27ff' }],
    description: 'A sock-like knit upper on a flexible, deeply grooved sole that bends with your foot. Good for easy runs and long days on your feet.',
    highlights: ['Stretchy knit upper', 'Flex-groove sole', 'Lightweight foam'],
    rating: 4.5, reviewCount: 203, featured: true, releasedAt: '2025-03-12', popularity: 84,
  },
  {
    id: 'P007', name: 'Nike Gym Trainer', brand: 'Nike', gender: 'men', categories: ['sports'],
    silhouette: 'runner', price: 29900,
    colours: [{ id: 'volt', name: 'Volt / Black', swatch: '#c9e83a', family: 'yellow', photo: '1606107557195-0e29a4b5b4aa' }],
    description: 'A stable trainer for HIIT and gym circuits, with a wide base and a cushioned forefoot for jumps and lunges.',
    highlights: ['Wide, stable platform', 'Cushioned forefoot', 'Breathable mesh upper'],
    rating: 4.4, reviewCount: 77, releasedAt: '2026-02-01', popularity: 63,
  },
  {
    id: 'P008', name: 'Nike Studio Trainer', brand: 'Nike', gender: 'women', categories: ['sports'],
    silhouette: 'runner', price: 27900, originalPrice: 31900,
    colours: [{ id: 'black', name: 'Black / White', swatch: '#1b1d22', family: 'black', photo: '1605408499391-6368c628ef42' }],
    description: 'A low-profile trainer for studio classes, strength days and short treadmill runs.',
    highlights: ['Low-to-the-ground feel', 'Grippy rubber outsole', 'Padded collar'],
    rating: 4.5, reviewCount: 58, releasedAt: '2025-11-10', popularity: 58,
  },
  // ---------------------------------------------------------------- adidas
  {
    id: 'P009', name: 'adidas Superstar', brand: 'adidas', gender: 'unisex', categories: ['lifestyle', 'casual'],
    silhouette: 'court', price: 29900,
    colours: [{ id: 'white-black', name: 'Cloud White / Core Black', swatch: '#f2f2ef', family: 'white', photo: '1593287073863-c992914cb3e3' }],
    description: 'The shell-toe classic: a rubber toe cap, three serrated stripes and a leather upper that has barely changed since the seventies.',
    highlights: ['Rubber shell toe', 'Leather upper', 'Herringbone rubber outsole'],
    rating: 4.7, reviewCount: 356, bestSeller: true, releasedAt: '2024-10-01', popularity: 93,
  },
  {
    id: 'P010', name: 'adidas Campus', brand: 'adidas', gender: 'unisex', categories: ['lifestyle', 'casual'],
    silhouette: 'court', price: 31900,
    colours: [{ id: 'burgundy', name: 'Burgundy / White', swatch: '#8a2433', family: 'red', photo: '1621665422246-fde75fb7e7f5' }],
    description: 'A suede court shoe from the archive, with a slim profile and contrast stripes.',
    highlights: ['Suede upper', 'Contrast three stripes', 'Rubber cupsole'],
    rating: 4.6, reviewCount: 142, featured: true, releasedAt: '2025-08-05', popularity: 88,
  },
  {
    id: 'P011', name: 'adidas Originals Retro Runner', brand: 'adidas', gender: 'unisex', categories: ['lifestyle', 'running'],
    silhouette: 'runner', price: 28900, originalPrice: 33900,
    colours: [{ id: 'white-navy', name: 'White / Navy', swatch: '#24315e', family: 'navy', photo: '1711719745936-ff93f602246e' }],
    description: 'Seventies running style for everyday wear: a nylon and suede upper, a Trefoil on the heel and a gum-tinted sole.',
    highlights: ['Nylon and suede upper', 'Trefoil heel tab', 'Lightweight EVA midsole'],
    rating: 4.5, reviewCount: 61, releasedAt: '2025-05-20', popularity: 66,
  },
  // ---------------------------------------------------------------- New Balance
  {
    id: 'P012', name: 'New Balance X-90', brand: 'New Balance', gender: 'women', categories: ['lifestyle', 'running'],
    silhouette: 'runner', price: 33900, originalPrice: 38900,
    colours: [{ id: 'pink-grey', name: 'Pink / Grey', swatch: '#e9a3b3', family: 'pink', photo: '1551107696-a4b0c5a0d9a2' }],
    description: 'A modern remix of a 990-series runner, with a knit collar and a sculpted foam midsole.',
    highlights: ['Knit sock-like collar', 'Sculpted foam midsole', 'Suede and mesh upper'],
    rating: 4.4, reviewCount: 49, releasedAt: '2025-01-15', popularity: 55,
  },
  {
    id: 'P013', name: 'New Balance 247', brand: 'New Balance', gender: 'men', categories: ['lifestyle', 'casual'],
    silhouette: 'runner', price: 31900,
    colours: [{ id: 'olive', name: 'Olive', swatch: '#6b6b3a', family: 'green', photo: '1539185441755-769473a23570' }],
    description: 'A slip-on-easy sneaker with a stretchy bootie fit and a cushioned sole for all-day wear.',
    highlights: ['Bootie construction', 'Cushioned foam midsole', 'Mesh and synthetic upper'],
    rating: 4.5, reviewCount: 88, releasedAt: '2025-07-01', popularity: 69,
  },
  {
    id: 'P014', name: 'New Balance Heritage Runner', brand: 'New Balance', gender: 'unisex', categories: ['lifestyle', 'running'],
    silhouette: 'runner', price: 36900,
    colours: [{ id: 'grey-navy', name: 'Grey / Navy', swatch: '#8d949e', family: 'grey', photo: '1778854096758-b787fdc26581' }],
    description: 'A heritage running silhouette in layered suede and mesh, with the big N on the side.',
    highlights: ['Suede and mesh upper', 'Cushioned midsole with heel support', 'Reflective details'],
    rating: 4.7, reviewCount: 39, newArrival: true, releasedAt: '2026-10-05', popularity: 80,
  },
  // ---------------------------------------------------------------- Converse & Vans
  {
    id: 'P015', name: 'Converse Chuck Taylor All Star High Top', brand: 'Converse', gender: 'unisex', categories: ['casual', 'lifestyle'],
    silhouette: 'hightop', price: 21900,
    colours: [{ id: 'green', name: 'Dark Green', swatch: '#1f3b2c', family: 'green', photo: '1463100099107-aa0980c362e6' }],
    description: 'The canvas high-top everyone recognises, with the round ankle patch and rubber toe cap.',
    highlights: ['Cotton canvas upper', 'Rubber toe cap', 'Vulcanised rubber sole'],
    rating: 4.6, reviewCount: 520, fit: 'large', bestSeller: true, releasedAt: '2024-06-01', popularity: 94,
  },
  {
    id: 'P016', name: 'Vans Sk8-Hi', brand: 'Vans', gender: 'unisex', categories: ['casual', 'lifestyle'],
    silhouette: 'hightop', price: 24900,
    colours: [{ id: 'checker', name: 'Checkerboard', swatch: '#efe8d4', family: 'beige', photo: '1626379530580-6a58c5cf1d5e' }],
    description: 'The skate high-top with a padded collar for ankle support, here in the checkerboard print.',
    highlights: ['Canvas and suede upper', 'Padded collar', 'Waffle rubber outsole'],
    rating: 4.7, reviewCount: 211, featured: true, releasedAt: '2025-03-01', popularity: 82,
  },
  {
    id: 'P017', name: 'Vans Old Skool', brand: 'Vans', gender: 'unisex', categories: ['casual', 'lifestyle'],
    silhouette: 'court', price: 22900,
    colours: [{ id: 'maroon', name: 'Port Royale', swatch: '#6e1f2e', family: 'red', photo: '1525966222134-fcfa99b8ae77' }],
    description: 'The low-top skate shoe with the side stripe, in a deep maroon canvas.',
    highlights: ['Canvas upper', 'Side stripe in leather', 'Signature waffle outsole'],
    rating: 4.6, reviewCount: 274, bestSeller: true, releasedAt: '2024-09-01', popularity: 91,
  },
  {
    id: 'P018', name: 'Vans Old Skool V (Kids)', brand: 'Vans', gender: 'kids', categories: ['casual', 'lifestyle'],
    silhouette: 'kids', price: 14900,
    colours: [{ id: 'black', name: 'Black / White', swatch: '#1b1d22', family: 'black', photo: '1605382165091-443eff32caf5' }],
    description: 'The Old Skool in kids’ sizes, with a hook-and-loop strap so little ones can put them on themselves.',
    highlights: ['Hook-and-loop strap', 'Canvas and suede upper', 'Waffle rubber outsole'],
    rating: 4.8, reviewCount: 97, featured: true, releasedAt: '2025-12-01', popularity: 76,
  },
  // ---------------------------------------------------------------- PUMA
  {
    id: 'P019', name: 'PUMA Suede Classic', brand: 'PUMA', gender: 'unisex', categories: ['lifestyle', 'casual'],
    silhouette: 'court', price: 24900, originalPrice: 27900,
    colours: [{ id: 'black', name: 'Black / White', swatch: '#1e2230', family: 'black', photo: '1545289414-1c3cb1c06238' }],
    description: 'A soft suede low-top with the Formstrip on the side, unchanged in spirit since 1968.',
    highlights: ['Suede upper', 'Formstrip side detail', 'Rubber outsole'],
    rating: 4.5, reviewCount: 133, releasedAt: '2024-11-11', popularity: 71,
  },
  {
    id: 'P020', name: 'PUMA Smash Leather', brand: 'PUMA', gender: 'unisex', categories: ['lifestyle', 'casual'],
    silhouette: 'court', price: 19900,
    colours: [{ id: 'white-red', name: 'White / Red', swatch: '#f4f4f2', family: 'white', photo: '1715003132895-b10a23d3c90f' }],
    description: 'A clean leather tennis-inspired sneaker with a red heel tab and gold foil branding.',
    highlights: ['Leather upper', 'Cushioned insole', 'Rubber cupsole'],
    rating: 4.4, reviewCount: 102, releasedAt: '2025-04-01', popularity: 65,
  },
  {
    id: 'P021', name: 'PUMA Perforated Court', brand: 'PUMA', gender: 'men', categories: ['lifestyle', 'casual'],
    silhouette: 'court', price: 18900,
    colours: [{ id: 'white', name: 'White', swatch: '#f4f4f2', family: 'white', photo: '1608231387042-66d1773070a5' }],
    description: 'An all-white leather court shoe with perforated side panels to let air in on hot days.',
    highlights: ['Perforated leather upper', 'Padded collar', 'Rubber outsole'],
    rating: 4.3, reviewCount: 54, releasedAt: '2025-01-05', popularity: 50,
  },
  // ---------------------------------------------------------------- ASICS, HOKA, Salomon
  {
    id: 'P022', name: 'ASICS GEL Retro Runner', brand: 'ASICS', gender: 'unisex', categories: ['lifestyle', 'running'],
    silhouette: 'runner', price: 39900,
    colours: [{ id: 'white-blue', name: 'White / Periwinkle', swatch: '#9fb0e6', family: 'blue', photo: '1575456456278-936c89ccdb7b' }],
    description: 'Early-2000s performance running design, now an everyday favourite: layered metallic overlays and GEL cushioning.',
    highlights: ['GEL cushioning', 'Mesh with synthetic overlays', 'Midfoot support shank'],
    rating: 4.7, reviewCount: 72, newArrival: true, featured: true, releasedAt: '2026-08-15', popularity: 89,
  },
  {
    id: 'P023', name: 'ASICS GEL-Lyte III', brand: 'ASICS', gender: 'unisex', categories: ['lifestyle', 'running'],
    silhouette: 'runner', price: 32900,
    colours: [{ id: 'blue', name: 'Royal Blue', swatch: '#2d5bd1', family: 'blue', photo: '1560072810-1cffb09faf0f' }],
    description: 'The split-tongue runner from 1990, in a bright royal blue suede and mesh.',
    highlights: ['Split tongue', 'GEL heel cushioning', 'Suede and mesh upper'],
    rating: 4.6, reviewCount: 64, releasedAt: '2025-06-20', popularity: 62,
  },
  {
    id: 'P024', name: 'ASICS GEL Road Runner', brand: 'ASICS', gender: 'men', categories: ['running', 'sports'],
    silhouette: 'runner', price: 34900, originalPrice: 39900,
    colours: [{ id: 'grey', name: 'Sheet Rock / Coral', swatch: '#9aa0a6', family: 'grey', photo: '1597892657493-6847b9640bac' }],
    description: 'A neutral daily trainer with GEL in the heel and a durable outsole for road miles.',
    highlights: ['GEL heel cushioning', 'Engineered mesh upper', 'Durable rubber outsole'],
    rating: 4.6, reviewCount: 150, bestSeller: true, releasedAt: '2025-02-20', popularity: 85,
  },
  {
    id: 'P025', name: 'HOKA Carbon Road Runner', brand: 'HOKA', gender: 'unisex', categories: ['running', 'sports'],
    silhouette: 'runner', price: 54900,
    colours: [{ id: 'white-lime', name: 'White / Lime', swatch: '#d6ef5a', family: 'yellow', photo: '1774280246516-5a817f172a39' }],
    description: 'Max cushion with a stiff plate and a rocker shape that rolls you forward. Built for long runs and race day.',
    highlights: ['Plated rocker midsole', 'High-stack cushioning', 'Breathable woven upper'],
    rating: 4.8, reviewCount: 41, fit: 'small', newArrival: true, featured: true, releasedAt: '2026-10-20', popularity: 87,
  },
  {
    id: 'P026', name: 'Salomon XT Trail Shoe', brand: 'Salomon', gender: 'unisex', categories: ['trail', 'sports'],
    silhouette: 'trail', price: 49900,
    colours: [{ id: 'white-red', name: 'White / Red / Black', swatch: '#c63a2f', family: 'red', photo: '1760465809553-ddcbe4bb4753' }],
    description: 'A grippy, stable trail shoe with quick-pull laces, ready for hill-country mud and loose rock.',
    highlights: ['Quick-lace system', 'Aggressive lugged outsole', 'Protective toe cap'],
    rating: 4.7, reviewCount: 36, newArrival: true, releasedAt: '2026-07-01', popularity: 70,
  },
  // ---------------------------------------------------------------- Reebok
  {
    id: 'P027', name: 'Reebok Club C 85', brand: 'Reebok', gender: 'unisex', categories: ['lifestyle', 'casual'],
    silhouette: 'court', price: 24900,
    colours: [
      { id: 'white', name: 'Chalk / Green', swatch: '#f4f2ec', family: 'white', photo: '1541597455068-49e3562bdfa4' },
      { id: 'grey', name: 'Pure Grey', swatch: '#b7b4ae', family: 'grey', photo: '1530389912609-9a007b3c38a4' },
    ],
    description: 'A soft leather tennis shoe from 1985 with a low-cut collar and a terry-lined inside.',
    highlights: ['Soft leather upper', 'Terry cloth lining', 'Die-cut EVA midsole'],
    rating: 4.6, reviewCount: 189, releasedAt: '2024-08-01', popularity: 77,
  },
  // ---------------------------------------------------------------- Boots, sandals, clogs
  {
    id: 'P028', name: 'Dr. Martens 1460 Boot', brand: 'Dr. Martens', gender: 'unisex', categories: ['boots', 'casual'],
    silhouette: 'boot', price: 54900,
    colours: [{ id: 'yellow', name: 'Yellow Smooth', swatch: '#f2c230', family: 'yellow', photo: '1481729379561-01e43a3e1ed4' }],
    description: 'The eight-eye boot with yellow welt stitching and an air-cushioned sole. Stiff at first; it softens and shapes to you.',
    highlights: ['Smooth leather upper', 'Goodyear-welted sole', 'Air-cushioned, oil-resistant outsole'],
    rating: 4.7, reviewCount: 143, fit: 'large', featured: true, releasedAt: '2025-01-20', popularity: 83,
  },
  {
    id: 'P029', name: 'Dr. Martens Tall Lace-Up Boot', brand: 'Dr. Martens', gender: 'unisex', categories: ['boots'],
    silhouette: 'boot', price: 62900,
    colours: [{ id: 'black', name: 'Black Smooth', swatch: '#151515', family: 'black', photo: '1747083996241-3d86d9dbab11' }],
    description: 'A taller lace-up in black smooth leather. This release has sold out; save it to hear when it returns.',
    highlights: ['Smooth leather upper', 'Welted construction', 'Air-cushioned sole'],
    rating: 4.6, reviewCount: 52, releasedAt: '2025-10-10', popularity: 60, soldOut: true,
  },
  {
    id: 'P030', name: 'Timberland 6-Inch Premium Boot', brand: 'Timberland', gender: 'men', categories: ['boots', 'trail'],
    silhouette: 'boot', price: 52900,
    colours: [{ id: 'grey', name: 'Dark Grey Nubuck', swatch: '#4a4d52', family: 'grey', photo: '1520472475098-8e72973f5462' }],
    description: 'A waterproof nubuck work boot with a padded collar and a lugged rubber sole that handles monsoon puddles.',
    highlights: ['Waterproof nubuck leather', 'Padded collar', 'Lugged rubber outsole'],
    rating: 4.7, reviewCount: 98, releasedAt: '2025-05-01', popularity: 74,
  },
  {
    id: 'P031', name: 'Birkenstock Arizona', brand: 'Birkenstock', gender: 'unisex', categories: ['sandals', 'casual'],
    silhouette: 'sandal', price: 27900,
    colours: [
      { id: 'taupe', name: 'Taupe Suede', swatch: '#a99c8c', family: 'beige', photo: '1603487742131-4160ec999306' },
      { id: 'black', name: 'Black', swatch: '#1b1d22', family: 'black', photo: '1504659913281-61817e6e2e9b' },
    ],
    description: 'The two-strap sandal with a contoured cork footbed that moulds to your feet over time.',
    highlights: ['Contoured cork-latex footbed', 'Adjustable buckle straps', 'EVA outsole'],
    rating: 4.8, reviewCount: 233, bestSeller: true, releasedAt: '2024-12-01', popularity: 90,
  },
  {
    id: 'P032', name: 'Crocs Classic Clog', brand: 'Crocs', gender: 'unisex', categories: ['sandals', 'casual'],
    silhouette: 'sandal', price: 14900,
    colours: [{ id: 'white', name: 'White', swatch: '#f6f6f4', family: 'white', photo: '1603145733190-59811e523c72' }],
    description: 'Light, washable foam clogs with a pivoting heel strap. Ideal for the beach, the garden and wet-season errands.',
    highlights: ['Lightweight foam', 'Ventilation ports', 'Pivoting heel strap'],
    rating: 4.5, reviewCount: 310, fit: 'large', releasedAt: '2024-07-01', popularity: 81,
  },
  // ---------------------------------------------------------------- Nishoes label (unbranded photos)
  {
    id: 'P033', name: 'Nishoes Suede Penny Loafer', brand: 'Nishoes', gender: 'men', categories: ['formal', 'casual'],
    silhouette: 'loafer', price: 26900,
    colours: [{ id: 'tan', name: 'Tan Suede', swatch: '#9a5b2e', family: 'brown', photo: '1576792741377-eb0f4f6d1a47' }],
    description: 'A soft suede penny loafer from our own label, made with a Colombo workshop. Unlined for a relaxed fit.',
    highlights: ['Hand-lasted in Sri Lanka', 'Suede upper', 'Leather sole with rubber heel'],
    rating: 4.6, reviewCount: 44, fit: 'small', releasedAt: '2025-06-11', popularity: 57,
  },
  {
    id: 'P034', name: 'Nishoes Horsebit Loafer', brand: 'Nishoes', gender: 'men', categories: ['formal'],
    silhouette: 'loafer', price: 29900, originalPrice: 34900,
    colours: [{ id: 'cognac', name: 'Cognac', swatch: '#8b4a22', family: 'brown', photo: '1616406432452-07bc5938759d' }],
    description: 'A polished leather loafer with a metal bit across the vamp, for weddings and office days.',
    highlights: ['Burnished calf leather', 'Metal horsebit detail', 'Leather lining'],
    rating: 4.7, reviewCount: 31, releasedAt: '2025-09-15', popularity: 54,
  },
  {
    id: 'P035', name: 'Nishoes Chelsea Boot', brand: 'Nishoes', gender: 'unisex', categories: ['boots', 'formal'],
    silhouette: 'boot', price: 32900,
    colours: [
      { id: 'black', name: 'Black Leather', swatch: '#1b1b1b', family: 'black', photo: '1788478963160-1c38139e2932' },
      { id: 'brown', name: 'Brown Leather', swatch: '#5c3a22', family: 'brown', photo: '1777987601423-f350ac29b3e9' },
    ],
    description: 'An elastic-sided ankle boot in smooth leather with pull tabs front and back. Smart enough for the office.',
    highlights: ['Smooth leather upper', 'Elastic side gussets', 'Rubber-injected sole'],
    rating: 4.6, reviewCount: 67, newArrival: true, releasedAt: '2026-09-01', popularity: 68,
  },
  {
    id: 'P036', name: 'Nishoes Ridge Hiker', brand: 'Nishoes', gender: 'men', categories: ['trail', 'boots'],
    silhouette: 'boot', price: 27900,
    colours: [{ id: 'sand', name: 'Sand', swatch: '#b59a73', family: 'beige', photo: '1788070637551-24858fcf50b5' }],
    description: 'A sturdy mid-height leather hiker for Horton Plains and Ella Rock, with a grippy lugged sole.',
    highlights: ['Leather upper', 'Mid-height ankle support', 'Lugged rubber outsole'],
    rating: 4.4, reviewCount: 29, releasedAt: '2026-04-01', popularity: 49,
  },
  {
    id: 'P037', name: 'Nishoes Baby Canvas High-Top', brand: 'Nishoes', gender: 'kids', categories: ['casual'],
    silhouette: 'kids', price: 6900,
    colours: [{ id: 'aqua', name: 'Aqua / Lilac', swatch: '#7fd3dc', family: 'blue', photo: '1624958797025-b119e2fa2b53' }],
    description: 'Soft printed canvas high-tops for first steps, with a flexible sole and an easy-open lace-up.',
    highlights: ['Soft canvas upper', 'Flexible non-slip sole', 'Padded collar'],
    rating: 4.8, reviewCount: 52, releasedAt: '2026-03-01', popularity: 46,
  },
  {
    id: 'P038', name: 'Nishoes Kids Easy-On', brand: 'Nishoes', gender: 'kids', categories: ['casual', 'sports'],
    silhouette: 'kids', price: 7900,
    colours: [{ id: 'pink', name: 'Pink / White', swatch: '#f1a0b4', family: 'pink', photo: '1766129486324-2d8894484750' }],
    description: 'A school-and-play sneaker with a hook-and-loop strap and a rubber toe bumper for scuffs.',
    highlights: ['Hook-and-loop strap', 'Rubber toe bumper', 'Non-marking sole'],
    rating: 4.7, reviewCount: 64, newArrival: true, releasedAt: '2026-10-01', popularity: 59,
  },
  {
    id: 'P039', name: 'Nishoes Baby Soft Sneaker', brand: 'Nishoes', gender: 'kids', categories: ['casual'],
    silhouette: 'kids', price: 5900,
    colours: [{ id: 'teal', name: 'Teal', swatch: '#2fb3b3', family: 'blue', photo: '1678192568478-9488ee55def6' }],
    description: 'Light printed baby sneakers with elastic laces that slip on and stay on.',
    highlights: ['Elastic laces', 'Soft cotton upper', 'Flexible sole'],
    rating: 4.6, reviewCount: 38, releasedAt: '2025-12-15', popularity: 44,
  },
];

const sizesBySystem: Record<Gender, string[]> = {
  men: ['6', '7', '8', '9', '10', '11', '12'],
  women: ['3', '4', '5', '6', '7', '8'],
  unisex: ['4', '5', '6', '7', '8', '9', '10', '11'],
  kids: ['10K', '11K', '12K', '13K', '1K', '2K'],
};

const materialsBySilhouette: Record<Silhouette, string> = {
  runner: 'Upper: mesh and/or knit textile with synthetic overlays. Midsole: foam cushioning. Outsole: rubber. Lining: textile.',
  trail: 'Upper: abrasion-resistant mesh with protective overlays. Midsole: foam. Outsole: lugged rubber.',
  court: 'Upper: leather, suede or canvas depending on colourway. Outsole: rubber cupsole. Lining: textile.',
  hightop: 'Upper: leather, suede or canvas depending on colourway. Outsole: rubber. Lining: padded textile.',
  boot: 'Upper: leather or nubuck. Lining: leather or textile. Outsole: rubber.',
  sandal: 'Upper: suede, leather or moulded foam depending on model. Footbed: contoured. Outsole: EVA or rubber.',
  loafer: 'Upper: calf leather or suede. Lining: leather. Sole: leather with rubber heel.',
  kids: 'Upper: canvas, textile or synthetic. Closure: laces, elastic or hook-and-loop. Outsole: non-marking rubber.',
};

const careBySilhouette: Record<Silhouette, string> = {
  runner: 'Remove insoles and air-dry away from direct sun. Hand wash with mild soap; do not machine dry.',
  trail: 'Rinse mud off after each run and stuff with newspaper to dry. Do not dry next to a heater.',
  court: 'Wipe leather with a damp cloth; brush suede when dry. Treat with a water repellent before the monsoon.',
  hightop: 'Spot-clean canvas with mild soap. Brush suede when dry.',
  boot: 'Brush off dirt, condition leather monthly, and let wet boots dry naturally at room temperature.',
  sandal: 'Wipe clean and air-dry in the shade. Keep cork footbeds away from prolonged heat.',
  loafer: 'Use cedar shoe trees, polish regularly, and rotate pairs to let the leather rest.',
  kids: 'Wipe clean with a damp cloth. Insoles can be hand washed.',
};

const categoryLabel = categoryLabels;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’'.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function sizeSystemFor(gender: Gender): SizeSystem {
  return gender === 'kids' ? 'kids' : 'adult';
}

function buildVariants(seed: ProductSeed, sizes: string[]): Variant[] {
  const rand = seededRandom(hashString(seed.id));
  const variants: Variant[] = [];
  for (const colour of seed.colours) {
    for (const size of sizes) {
      let stock: number;
      if (seed.soldOut) stock = 0;
      else {
        const r = rand();
        if (r < 0.14) stock = 0;
        else if (r < 0.32) stock = 1 + Math.floor(rand() * 3);
        else stock = 4 + Math.floor(rand() * 12);
      }
      variants.push({ sku: `${seed.id}-${colour.id.toUpperCase()}-${size}`, colourId: colour.id, size, stock });
    }
  }
  return variants;
}

function closureFor(s: Silhouette): string {
  if (s === 'sandal') return 'Straps';
  if (s === 'loafer') return 'Slip-on';
  if (s === 'kids') return 'Laces, elastic or hook and loop';
  return 'Laces';
}

function buildProduct(seed: ProductSeed): Product {
  const sizes = sizesBySystem[seed.gender];
  const genderLabel = { men: 'Men', women: 'Women', kids: 'Kids', unisex: 'Unisex' }[seed.gender];
  return {
    id: seed.id,
    slug: `${slugify(seed.name)}-${seed.id.toLowerCase()}`,
    name: seed.name,
    brand: seed.brand,
    gender: seed.gender,
    categories: seed.categories,
    description: seed.description,
    highlights: seed.highlights,
    price: seed.price,
    originalPrice: seed.originalPrice,
    colours: seed.colours.map((c) => ({
      id: c.id,
      name: c.name,
      swatch: c.swatch,
      family: c.family,
      images: photoGallery(c.photo),
    })),
    sizes,
    sizeSystem: sizeSystemFor(seed.gender),
    variants: buildVariants(seed, sizes),
    rating: seed.rating,
    reviewCount: seed.reviewCount,
    specifications: [
      { label: 'Brand', value: seed.brand },
      { label: 'Style code', value: `${seed.id}-${seed.gender.slice(0, 1).toUpperCase()}` },
      { label: 'Fit', value: genderLabel },
      { label: 'Category', value: seed.categories.map((c) => categoryLabel[c]).join(', ') },
      { label: 'Sizing', value: seed.fit === 'small' ? 'Runs small, so order half a size up' : seed.fit === 'large' ? 'Runs large, so order half a size down' : 'True to size' },
      { label: 'Closure', value: closureFor(seed.silhouette) },
    ],
    materials: materialsBySilhouette[seed.silhouette],
    care: careBySilhouette[seed.silhouette],
    fit: seed.fit ?? 'true',
    isFeatured: Boolean(seed.featured),
    isNewArrival: Boolean(seed.newArrival),
    isBestSeller: Boolean(seed.bestSeller),
    releasedAt: seed.releasedAt,
    popularity: seed.popularity,
    silhouette: seed.silhouette,
  };
}

/**
 * MOCK MODE ONLY. In API mode this catalogue is not used (or bundled): products come from SQL Server
 * through the Nishoes API. The pure annotation lets the bundler drop it when nothing imports it.
 */
export const products: Product[] = /* @__PURE__ */ seeds.map(buildProduct);
