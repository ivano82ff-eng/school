import { theme } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { getScheme } from './colors';

export const antdLocale = ruRU;

const sharedSizing = {
  borderRadius: 14,
  fontSize: 16,
  fontSizeHeading1: 38,
  fontSizeHeading2: 30,
  fontSizeHeading3: 24,
  fontSizeHeading4: 20,
  fontSizeHeading5: 18,
  sizeStep: 5,
  sizeUnit: 4,
  controlHeight: 48,
  controlHeightLG: 56,
  controlHeightSM: 40,
  fontFamily:
    "'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const sharedComponents = {
  Layout: {
    headerHeight: 76,
    bodyBg: 'transparent',
    footerBg: 'transparent',
    headerPadding: '0 20px',
  },
  Menu: {
    itemBorderRadius: 999,
    itemHeight: 48,
    fontSize: 16,
  },
  Button: {
    controlHeight: 52,
    controlHeightLG: 58,
    contentFontSize: 16,
    fontWeight: 700,
    paddingInline: 22,
    borderRadius: 999,
  },
  Input: {
    controlHeight: 52,
    inputFontSize: 16,
    paddingInline: 16,
  },
  Select: {
    controlHeight: 52,
  },
  Card: {
    borderRadiusLG: 20,
    paddingLG: 28,
    headerFontSize: 20,
  },
  Form: {
    labelFontSize: 16,
    itemMarginBottom: 22,
  },
  Statistic: {
    contentFontSize: 30,
    titleFontSize: 15,
  },
  Tag: {
    fontSize: 14,
  },
};

/** Build Ant Design theme from global scheme tokens */
export function buildAntdTheme(mode = 'light') {
  const s = getScheme(mode);
  const isDark = mode === 'dark';

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...sharedSizing,
      colorPrimary: s.primary,
      colorPrimaryHover: s.primaryHover,
      colorPrimaryActive: s.primaryHover,
      colorInfo: s.accent,
      colorSuccess: s.success,
      colorWarning: s.warning,
      colorError: s.error,
      colorLink: s.primary,
      colorBgBase: s.bg,
      colorBgContainer: s.surface,
      colorBgElevated: s.elevated,
      colorBgLayout: s.bg,
      colorBorder: s.border,
      colorBorderSecondary: s.border,
      colorText: s.text,
      colorTextSecondary: s.textSecondary,
      colorTextTertiary: s.textMuted,
      colorTextPlaceholder: s.textSecondary,
      colorFillAlter: s.bgSubtle,
    },
    components: {
      ...sharedComponents,
      Layout: {
        ...sharedComponents.Layout,
        headerBg: s.headerBg,
      },
      Menu: {
        ...sharedComponents.Menu,
        darkItemBg: 'transparent',
        darkItemSelectedBg: s.primarySoft,
        darkItemHoverBg: s.accentSoft,
        itemSelectedBg: s.primarySoft,
        itemHoverBg: s.accentSoft,
        horizontalItemSelectedColor: s.primary,
        horizontalItemHoverColor: s.primary,
        itemSelectedColor: s.primary,
        colorItemText: s.textSecondary,
        colorItemTextSelected: s.primary,
      },
      Button: {
        ...sharedComponents.Button,
        primaryColor: s.btnPrimaryText,
        defaultBg: s.btnSecondaryBg,
        defaultBorderColor: s.btnSecondaryBorder,
        defaultColor: s.btnSecondaryText,
        defaultHoverBg: s.surface,
        defaultHoverBorderColor: s.primaryHover,
        defaultHoverColor: s.primaryHover,
        defaultActiveBorderColor: s.primaryHover,
        defaultActiveColor: s.primaryHover,
        colorPrimaryHover: s.primaryHover,
      },
      Table: {
        headerBg: isDark ? s.elevated : s.bg,
        headerColor: s.text,
        rowHoverBg: s.selection,
        borderColor: s.border,
        cellPaddingBlock: 18,
        cellPaddingInline: 18,
        fontSize: 16,
      },
      Tag: {
        ...sharedComponents.Tag,
        defaultBg: s.primarySoft,
        defaultColor: s.primary,
      },
      Card: {
        ...sharedComponents.Card,
        colorBgContainer: s.surface,
      },
      Modal: {
        contentBg: s.surface,
        headerBg: s.surface,
      },
      Drawer: {
        colorBgElevated: s.surface,
      },
      Dropdown: {
        controlItemBgHover: s.selection,
      },
      Input: {
        ...sharedComponents.Input,
        colorBgContainer: s.surface,
        hoverBorderColor: s.primary,
        activeBorderColor: s.primary,
      },
      Select: {
        ...sharedComponents.Select,
        colorBgContainer: s.surface,
      },
    },
  };
}

export {
  brand,
  schemes,
  getScheme,
  applyCssVars,
  readStoredMode,
  THEME_STORAGE_KEY,
  semantic,
} from './colors';
