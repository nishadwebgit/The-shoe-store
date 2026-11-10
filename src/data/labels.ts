import type { Gender, StyleCategory } from '../types';

/** Display labels and orderings used by the UI in both mock and API mode. */
export const categoryLabels: Record<StyleCategory, string> = {
  running: 'Running', sports: 'Sports & training', casual: 'Casual', lifestyle: 'Lifestyle',
  trail: 'Trail', formal: 'Formal', sandals: 'Sandals', boots: 'Boots',
};

export const genderLabels: Record<Gender, string> = { men: 'Men', women: 'Women', kids: 'Kids', unisex: 'Unisex' };

export const sizeOrder: string[] = ['10K', '11K', '12K', '13K', '1K', '2K', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
