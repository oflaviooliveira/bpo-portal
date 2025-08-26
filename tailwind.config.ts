import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // Gquicks Brand Colors
        "gquicks-primary": {
          DEFAULT: "#E40064",
          50: "#FDF2F8",
          100: "#FCE7F3",
          200: "#FBCFE8",
          300: "#F9A8D4",
          400: "#F472B6",
          500: "#E40064",
          600: "#BE185D",
          700: "#9D174D",
          800: "#831843",
          900: "#701A38",
          950: "#4C0519",
        },
        "gquicks-secondary": {
          DEFAULT: "#0B0E30",
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0B0E30",
          950: "#020617",
        },
        "gquicks-accent": {
          DEFAULT: "#FFFFFF",
          50: "#FFFFFF",
          100: "#FEFEFE",
          200: "#FEFEFE",
          300: "#FDFDFD",
          400: "#FCFCFC",
          500: "#FAFAFA",
          600: "#F5F5F5",
          700: "#EEEEEE",
          800: "#E0E0E0",
          900: "#BDBDBD",
          950: "#9E9E9E",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Poppins", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "Menlo", "monospace"],
        gilroy: ["var(--font-gilroy)", "Gilroy", "sans-serif"],
        poppins: ["Poppins", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        fadeIn: {
          from: {
            opacity: "0",
            transform: "translateY(10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        slideInFromLeft: {
          from: {
            transform: "translateX(-100%)",
          },
          to: {
            transform: "translateX(0)",
          },
        },
        pulse: {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.5",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fadeIn 0.3s ease-in",
        "slide-in-left": "slideInFromLeft 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glow-primary": "0 0 20px rgba(228, 0, 100, 0.3)",
        "glow-secondary": "0 0 20px rgba(11, 14, 48, 0.3)",
        "card-hover": "0 8px 25px rgba(0, 0, 0, 0.1)",
        "sidebar": "0 4px 12px rgba(228, 0, 100, 0.3)",
      },
      backgroundImage: {
        "gradient-gquicks": "linear-gradient(135deg, #E40064 0%, #B8004D 100%)",
        "gradient-gquicks-light": "linear-gradient(135deg, rgba(228, 0, 100, 0.1) 0%, rgba(228, 0, 100, 0.05) 100%)",
        "gradient-hero": "linear-gradient(135deg, #E40064 0%, #0B0E30 100%)",
      },
      screens: {
        "xs": "475px",
        "3xl": "1600px",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"), 
    require("@tailwindcss/typography"),
    function({ addUtilities }: any) {
      addUtilities({
        '.bg-gquicks-primary': {
          'background-color': '#E40064',
        },
        '.bg-gquicks-secondary': {
          'background-color': '#0B0E30',
        },
        '.text-gquicks-primary': {
          'color': '#E40064',
        },
        '.text-gquicks-secondary': {
          'color': '#0B0E30',
        },
        '.border-gquicks-primary': {
          'border-color': '#E40064',
        },
        '.border-gquicks-secondary': {
          'border-color': '#0B0E30',
        },
        '.sidebar-active': {
          'background': 'linear-gradient(135deg, #E40064 0%, #B8004D 100%)',
          'box-shadow': '0 4px 12px rgba(228, 0, 100, 0.3)',
        },
        '.chart-gradient': {
          'background': 'linear-gradient(135deg, #E40064 0%, #FF4081 100%)',
        },
        '.upload-zone': {
          'border': '2px dashed #E40064',
          'background': 'linear-gradient(135deg, rgba(228, 0, 100, 0.05) 0%, rgba(228, 0, 100, 0.02) 100%)',
          'transition': 'all 0.3s ease',
        },
        '.upload-zone:hover': {
          'border-color': '#B8004D',
          'background': 'linear-gradient(135deg, rgba(228, 0, 100, 0.1) 0%, rgba(228, 0, 100, 0.05) 100%)',
        },
        '.card-hover': {
          'transition': 'all 0.3s ease',
        },
        '.card-hover:hover': {
          'transform': 'translateY(-2px)',
          'box-shadow': '0 8px 25px rgba(0, 0, 0, 0.1)',
        },
      });
    },
  ],
} satisfies Config;
