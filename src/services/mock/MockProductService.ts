import { appConfig } from '../../config/appConfig';
import { categories, sampleReviews } from '../../data/mockContent';
import { productInStock, queryProducts } from '../../features/catalogue/queryProducts';
import type { Category, Product, ProductQuery, ProductSearchResult, Review } from '../../types';
import type { IInventoryService, IProductService } from '../interfaces';
import { delay, findSku, getCatalogue } from './mockInfrastructure';

export class MockProductService implements IProductService {
  async searchProducts(query: ProductQuery): Promise<ProductSearchResult> {
    return delay(queryProducts(getCatalogue(), { pageSize: appConfig.pageSize, ...query }));
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    return delay(getCatalogue().find((p) => p.slug === slug));
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    const catalogue = getCatalogue();
    return delay(ids.map((id) => catalogue.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)), 120);
  }

  async getCategories(): Promise<Category[]> {
    return delay(categories, 80);
  }

  async getCollection(collection: 'featured' | 'new' | 'best-sellers' | 'sale', limit = 8): Promise<Product[]> {
    const all = getCatalogue().filter(productInStock);
    let list: Product[];
    switch (collection) {
      case 'featured':
        list = all.filter((p) => p.isFeatured).sort((a, b) => b.popularity - a.popularity);
        break;
      case 'new':
        list = all.filter((p) => p.isNewArrival).sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
        break;
      case 'best-sellers':
        list = all.filter((p) => p.isBestSeller).sort((a, b) => b.popularity - a.popularity);
        break;
      case 'sale':
        list = all.filter((p) => p.originalPrice && p.originalPrice > p.price);
        break;
    }
    return delay(list.slice(0, limit));
  }

  async getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
    const all = getCatalogue();
    const source = all.find((p) => p.id === productId);
    if (!source) return delay([]);
    const scored = all
      .filter((p) => p.id !== productId && p.name !== source.name && productInStock(p))
      .map((p) => {
        const shared = p.categories.filter((c) => source.categories.includes(c)).length;
        const genderMatch = p.gender === source.gender || p.gender === 'unisex' || source.gender === 'unisex' ? 1 : 0;
        return { p, score: shared * 3 + genderMatch * 2 + (p.brand === source.brand ? 1 : 0) + p.popularity / 100 };
      })
      .sort((a, b) => b.score - a.score);
    return delay(scored.slice(0, limit).map((s) => s.p));
  }

  async getRecommendations(excludeIds: string[], limit = 4): Promise<Product[]> {
    const list = getCatalogue()
      .filter((p) => !excludeIds.includes(p.id) && productInStock(p))
      .sort((a, b) => b.rating * 20 + b.popularity - (a.rating * 20 + a.popularity));
    return delay(list.slice(0, limit));
  }

  async getReviews(productId: string): Promise<Review[]> {
    const product = getCatalogue().find((p) => p.id === productId);
    return delay(product ? sampleReviews(product.id, product.sizes, product.rating) : []);
  }

  async getBrands(): Promise<string[]> {
    return delay([...new Set(getCatalogue().map((p) => p.brand))].sort(), 60);
  }
}

export class MockInventoryService implements IInventoryService {
  async checkStock(skus: string[]) {
    return delay(skus.map((sku) => ({ sku, available: findSku(sku).variant?.stock ?? 0 })), 80);
  }
}
