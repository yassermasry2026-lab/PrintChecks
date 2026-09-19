# PrintChecks Application

This directory contains the main **PrintChecks** application—a comprehensive check printing and payment documentation system built with Vue.js 3, TypeScript, and modern web technologies.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18+ LTS recommended)
- **npm** or **yarn** package manager

### Installation

1. **Install dependencies**

```bash
npm install
```

2. **Start development server**

```bash
npm run dev
```

3. **Open in browser**
   Navigate to `http://localhost:5173/` to start using PrintChecks

### Production Build

```bash
npm run build
```

The optimized production build will be output to the `dist/` directory.

---

## 📁 Project Structure

```
src/
├── components/              # Vue components
│   ├── BankAccountModal.vue   # Bank account management modal
│   ├── CheckPrinter.vue        # Main check printing component
│   ├── VendorModal.vue         # Vendor management modal
│   ├── customization/          # Customization-related components
│   │   └── CustomizationPanel.vue
│   └── receipt/                # Receipt and line item components
│       └── LineItemManager.vue
│
├── composables/             # Reusable composition functions
│   └── useFormatting.ts       # Currency and number formatting utilities
│
├── stores/                  # Pinia state management stores
│   ├── app.ts                 # Global application state and config
│   ├── check.ts               # Check creation and management
│   ├── customization.ts       # Styling, fonts, colors, presets
│   ├── receipt.ts             # Receipt functionality and line items
│   └── history.ts             # Payment history tracking
│
├── types/                   # TypeScript type definitions
│   ├── check.ts               # Check-related types
│   ├── customization.ts       # Customization and styling types
│   ├── receipt.ts             # Receipt and line item types
│   ├── common.ts              # Shared/common types
│   └── index.ts               # Centralized type exports
│
├── views/                   # Vue Router views (pages)
│   ├── HomeView.vue           # Main check printing interface
│   ├── BankAccountsView.vue   # Bank account management
│   ├── VendorsView.vue        # Vendor management
│   ├── ReceiptView.vue        # Receipt creation and printing
│   ├── HistoryView.vue        # Payment history and search
│   ├── AnalyticsView.vue      # Payment analytics and insights
│   └── CustomizationView.vue  # Check customization settings
│
├── router/                  # Vue Router configuration
│   └── index.ts               # Route definitions
│
├── assets/                  # Static assets (fonts, styles, images)
│
├── utilities.ts             # General utility functions
└── main.ts                  # Application entry point and setup
```

---

## 🎯 Core Features

### ✅ Check Printing

- **Professional Layout**: Print on standard 8.5" x 11" paper with precise positioning
- **E13B MICR Font**: Official banking font for routing and account numbers
- **Currency Conversion**: Automatic amount-to-words conversion with proper formatting
- **Multi-Account Support**: Manage multiple bank accounts with ease
- **Custom Signatures**: Optional elegant signature fonts
- **Logo Integration**: Upload and position company logos

### 🎨 Customization System

- **Font Controls**: Customize fonts for all check elements (payee, amount, memo, etc.)
- **Color Schemes**: Full color customization with preset themes
- **Logo Management**: Upload, position, and resize logos
- **Preset System**: Save and load custom style presets for quick switching
- **Real-time Preview**: See changes instantly before printing
- **Coming Soon**: Advanced layout controls for spacing and positioning

### 📋 Receipt Management

- **Line Items**: Create itemized receipts with descriptions, quantities, and prices
- **Automatic Calculations**: Subtotal, tax, and total calculations
- **Professional Output**: Business-ready receipt formatting
- **Print Integration**: Seamless printing with check printing workflow

### 👥 Vendor Management

- **Contact Information**: Store name, address, email, and phone for each vendor
- **Quick Fill**: Auto-populate check fields from vendor data
- **Payment History**: Track all payments made to each vendor
- **Coming Soon**: Advanced search, filtering, and data export capabilities

### 📊 Analytics & Insights

- **Payment Trends**: Visualize payment volume over time
- **Top Vendors**: Identify vendors by payment amount and frequency
- **Monthly Breakdown**: Analyze spending patterns by month
- **Check Statistics**: Track total checks written, average amounts, etc.
- **Historical Summaries**: Comprehensive payment summaries with detailed breakdowns

### 📚 History System

- **Complete History**: Unified view of all checks, receipts, and payments
- **Immutable Log**: Payment records are unalterable for accuracy
- **Coming Soon**: Enhanced search, filtering, pagination, sorting, and data export

### 🔒 Privacy & Security

PrintChecks operates with **privacy as the core principle**:

- ✅ **100% Local**: All data processing happens in your browser
- ✅ **No Network Requests**: Zero external server communication
- ✅ **Local Storage**: All data stored locally in browser localStorage
- ✅ **No Tracking**: No analytics, cookies, or user tracking
- ✅ **No Server**: Runs entirely client-side—no backend required
- ✅ **Open Source**: Fully auditable codebase

**Your banking information never leaves your computer.**

---

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload at http://localhost:5173
npm run dev:clear        # Start dev with cleared localStorage (for debugging)

# Production
npm run build            # Type-check and build for production
npm run build-only       # Build without type checking (faster)
npm run preview          # Preview production build locally

# Code Quality
npm run type-check       # Run TypeScript type checking
npm run lint             # Lint and auto-fix code with ESLint
npm run format           # Format code with Prettier

# Maintenance
npm run cleanup          # Clean up debug scripts from index.html (if needed)
```

### Technology Stack

- **[Vue.js 3](https://vuejs.org/)** (Composition API) - Progressive JavaScript framework
- **[TypeScript](https://www.typescriptlang.org/)** (~5.0.4) - Type-safe JavaScript superset
- **[Pinia](https://pinia.vuejs.org/)** (^2.1.3) - Intuitive state management for Vue
- **[Vue Router](https://router.vuejs.org/)** (^4.2.2) - Official routing for Vue
- **[Vite](https://vitejs.dev/)** (^4.3.9) - Next-generation build tool and dev server
- **[Bootstrap 5](https://getbootstrap.com/)** - Responsive CSS framework
- **[to-words](https://www.npmjs.com/package/to-words)** (^4.1.0) - Number to words conversion
- **[print-js](https://printjs.crabbly.com/)** (^1.6.0) - Browser printing library

### Code Style & Quality

This project enforces code quality through:

- **ESLint** - JavaScript/TypeScript linting with Vue-specific rules
- **Prettier** - Consistent code formatting (`.prettierrc.json`)
- **TypeScript** - Full type safety across the codebase
- **Vue ESLint Config** - Official Vue.js linting standards

Configuration files:

- `.eslintrc.cjs` - ESLint rules and parser configuration
- `.prettierrc.json` - Prettier formatting rules
- `tsconfig.json` - TypeScript compiler options

---

## 🏗️ Architecture Overview

### State Management (Pinia Stores)

The application uses **Pinia** for centralized state management:

1. **`app.ts`** - Global application state
   - Bank accounts management
   - Vendors management
   - Application settings

2. **`check.ts`** - Check creation and printing
   - Check form state
   - Check printing logic
   - Check validation

3. **`customization.ts`** - Visual customization
   - Font selections
   - Color schemes
   - Logo management
   - Style presets

4. **`receipt.ts`** - Receipt functionality
   - Line item management
   - Tax and fee calculations
   - Receipt generation

5. **`history.ts`** - Payment history
   - Payment logging (immutable)
   - Search and filtering
   - History analytics

### Composables

Reusable composition functions for shared logic:

- **`useFormatting.ts`** - Currency, number, and date formatting utilities

### Component Organization

- **`components/`** - Shared, reusable components
  - Modals for data entry
  - Core check printing component
  - Specialized sub-components for customization and receipts

- **`views/`** - Page-level components tied to routes
  - Each view represents a major application feature
  - Connected to router for navigation

---

## 🔧 Development Tips

### Clearing History During Development

When testing the history/logging system, use the special dev command:

```bash
npm run dev:clear
```

This automatically clears localStorage on startup. See `scripts/README.md` for details.

### Local Storage Schema

Data is stored in browser localStorage with these keys:

- `checkList` - Immutable payment history
- `bankAccounts` - Bank account information
- `vendors` - Vendor contact information
- `customization` - Style presets and settings
- `receipts` - Receipt data and line items

### Print Optimization

Check and receipt printing uses `print-js` for consistent cross-browser output. Key considerations:

- Print CSS is scoped to `.printable` classes
- Page breaks are controlled via CSS
- MICR fonts require proper embedding
- Test in Chrome/Firefox for best results

---

## 🤝 Contributing

We welcome contributions! To get started:

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch**: `git checkout -b feature/my-feature`
4. **Make your changes** with proper TypeScript types
5. **Run quality checks**: `npm run lint && npm run type-check`
6. **Test thoroughly** in your browser
7. **Commit your changes**: `git commit -m 'Add my feature'`
8. **Push to your fork**: `git push origin feature/my-feature`
9. **Open a Pull Request** on the main repository

### Contribution Guidelines

- Follow existing code style (enforced by ESLint/Prettier)
- Write proper TypeScript with explicit types
- Update tests if adding new features
- Document complex logic with comments
- Keep commits focused and atomic
- Update relevant documentation

---

## 🐛 Troubleshooting

### Issue: Dev server won't start

**Solution:**

```bash
# Clear modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Issue: TypeScript errors

**Solution:**

```bash
# Run type checking to see all errors
npm run type-check

# Ensure your IDE is using the workspace TypeScript version
```

### Issue: Fonts not displaying

**Solution:**

- Check browser console for font loading errors
- Clear browser cache and reload

### Issue: Printing looks wrong

**Solution:**

- Enable "Background graphics" in browser print settings
- Set margins to minimum or "None"
- Use 100% scale (no fit-to-page)
- Test in Chrome or Firefox

### Issue: Data not persisting

**Solution:**

- Check that localStorage is enabled in your browser
- Ensure you're not in private/incognito mode
- Check browser console for quota exceeded errors
- Export your data as backup before clearing localStorage

---

## 📚 Additional Resources

### Debug Scripts

See [`scripts/README.md`](scripts/README.md) for information about development utility scripts.

### Type Definitions

All TypeScript types are defined in `src/types/`. Import from `src/types/index.ts` for centralized access.

### Routing

Routes are defined in `src/router/index.ts`. All routes use lazy loading for optimal performance.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](../LICENSE) file for details.

---

**PrintChecks Application: Professional check printing and payment documentation, privately and securely in your browser.** 🏦✨
