import { useState, useCallback } from 'react';
import { AppSettings, MaterialDryingConfig, BrandConfig } from '../types/filament';
import { safeStorage } from '../utils/safeStorage';
import { STORAGE_KEY_SETTINGS } from '../utils/storageKeys';
import { DEFAULT_APP_SETTINGS } from '../data/defaultSpools';

interface useAppSettingsParams {
  showToast: any;
}

export function useAppSettings({ showToast }: useAppSettingsParams) {
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const raw = safeStorage.getItem(STORAGE_KEY_SETTINGS) || safeStorage.getItem('filamenthub_settings_v122');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.materialPresets && parsed.brandPresets) {
          return {
            materialPresets: { ...DEFAULT_APP_SETTINGS.materialPresets, ...parsed.materialPresets },
            brandPresets: { ...DEFAULT_APP_SETTINGS.brandPresets, ...parsed.brandPresets },
            eibosBagTara: typeof parsed.eibosBagTara === 'number' ? parsed.eibosBagTara : DEFAULT_APP_SETTINGS.eibosBagTara,
            silicaBagTara: typeof parsed.silicaBagTara === 'number' ? parsed.silicaBagTara : DEFAULT_APP_SETTINGS.silicaBagTara,
            cardSize: typeof parsed.cardSize === 'number' ? parsed.cardSize : (DEFAULT_APP_SETTINGS.cardSize || 340)
          };
        }
      }
    } catch {}
    return DEFAULT_APP_SETTINGS;
  });

  const persistSettings = useCallback((newSettings: AppSettings) => {
    setAppSettings(newSettings);
    try {
      safeStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    } catch {}
  }, []);

  const handleUpdateCardSize = useCallback((size: number) => {
    setAppSettings(prev => {
      const next = { ...prev, cardSize: size };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const handleUpdateMaterialPreset = useCallback((mat: string, config: MaterialDryingConfig) => {
    setAppSettings(prev => {
      const next = {
        ...prev,
        materialPresets: {
          ...prev.materialPresets,
          [mat]: config
        }
      };
      persistSettings(next);
      return next;
    });
    showToast(`Trocknungsparameter für ${mat} gespeichert.`);
  }, [persistSettings, showToast]);

  const handleResetMaterialPreset = useCallback((mat: string) => {
    setAppSettings(prev => {
      const def = DEFAULT_APP_SETTINGS.materialPresets[mat];
      if (!def) return prev;
      const next = {
        ...prev,
        materialPresets: {
          ...prev.materialPresets,
          [mat]: def
        }
      };
      persistSettings(next);
      return next;
    });
    showToast(`Werkseinstellung für ${mat} wiederhergestellt.`);
  }, [persistSettings, showToast]);

  const handleUpdateBrandPreset = useCallback((brand: string, config: BrandConfig) => {
    setAppSettings(prev => {
      const next = {
        ...prev,
        brandPresets: {
          ...prev.brandPresets,
          [brand]: config
        }
      };
      persistSettings(next);
      return next;
    });
    showToast(`Standard-Tara für ${brand} gespeichert.`);
  }, [persistSettings, showToast]);

  const handleResetBrandPreset = useCallback((brand: string) => {
    setAppSettings(prev => {
      const def = DEFAULT_APP_SETTINGS.brandPresets[brand];
      if (!def) return prev;
      const next = {
        ...prev,
        brandPresets: {
          ...prev.brandPresets,
          [brand]: def
        }
      };
      persistSettings(next);
      return next;
    });
    showToast(`Werkseinstellung für ${brand} wiederhergestellt.`);
  }, [persistSettings, showToast]);

  const handleUpdateEibosBagTara = useCallback((tara: number) => {
    setAppSettings(prev => {
      const next = {
        ...prev,
        eibosBagTara: tara
      };
      persistSettings(next);
      return next;
    });
    showToast(`Eibos-Beutel Tara auf ${tara}g aktualisiert.`);
  }, [persistSettings, showToast]);

  const handleResetAllSettings = useCallback(() => {
    persistSettings(DEFAULT_APP_SETTINGS);
    showToast('Alle Einstellungen auf Standard zurückgesetzt.');
  }, [persistSettings, showToast]);

  return { appSettings, handleUpdateMaterialPreset, handleResetMaterialPreset, handleUpdateBrandPreset, handleResetBrandPreset, handleUpdateEibosBagTara, handleUpdateCardSize, handleResetAllSettings };
}
