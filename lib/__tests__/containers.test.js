jest.mock('../supabase', () => ({ supabase: {} }));

import { containerLabel, containerSize, materialLabel } from '../containers';

const pot = { material: 'fabric', volume_liters: 11 };

describe('materialLabel', () => {
  it('names the materials, falling back to plastic', () => {
    expect(materialLabel('fabric')).toBe('Fabric');
    expect(materialLabel('terracotta')).toBe('Terracotta');
    expect(materialLabel(undefined)).toBe('Plastic');
  });
});

describe('containerLabel', () => {
  it('reads a pot the way a grower would say it', () => {
    expect(containerLabel(pot, 'metric')).toBe('11 L Fabric');
  });

  it('converts the size to the unit the grower reads', () => {
    expect(containerLabel({ ...pot, volume_liters: 3.785411784 }, 'imperial')).toBe('1 gal Fabric');
  });

  it('is null when the plant is in no container, or its group was deleted', () => {
    expect(containerLabel(null, 'metric')).toBeNull();
    expect(containerLabel(undefined, 'metric')).toBeNull();
  });
});

describe('containerSize', () => {
  it('gives just the size, for tiles with no room for the material', () => {
    expect(containerSize(pot, 'metric')).toBe('11 L');
  });

  it('is null without a container', () => {
    expect(containerSize(null, 'metric')).toBeNull();
  });
});
