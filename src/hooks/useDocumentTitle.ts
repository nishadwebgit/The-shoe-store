import { useEffect } from 'react';
import { brand } from '../config/brand';

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} | ${brand.name}` : `${brand.name} | ${brand.tagline}`;
  }, [title]);
}
