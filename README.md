# Synergy Learning Academy - Website Clone

A complete full-stack website for a corporate training academy, built with vanilla HTML/CSS/JS frontend and Node.js/Express backend.

## 📁 Project Structure

```
synergy-clone/
├── frontend/
│   └── index.html          # Complete single-file frontend (HTML + CSS + JS)
├── backend/
│   ├── server.js            # Express API server
│   ├── package.json         # Node.js dependencies
│   ├── .env                 # Environment configuration
│   └── data/
│       └── contacts.db      # SQLite database (auto-created)
└── README.md
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start the Server

```bash
npm start
```

### 3. Open in Browser

Visit **http://localhost:5000**

That's it! The server serves both the frontend and the API.

---

## 🎨 How to Customize

### Change Company Name & Branding

Open `frontend/index.html` and find/replace:

| Find                              | Replace With              |
|-----------------------------------|---------------------------|
| `Synergy Learning Academy`        | Your company name         |
| `Synergy Learning`                | Your short brand name     |
| `Chennai`                         | Your city                 |
| `info@synergylearningacademy.com` | Your email                |
| `+91 98765 43210`                 | Your phone number         |
| `wa.me/919876543210`              | Your WhatsApp number      |

### Change Colors

Edit the CSS variables in `index.html` under `:root`:

```css
:root {
  --yellow: #f5a623;           /* Primary accent (buttons, highlights) */
  --dark-blue: #1a1a4e;        /* Headings color */
  --maroon: #8b1538;           /* Service card titles */
  --gradient-hero: linear-gradient(135deg, #2d1b69 0%, #1a237e 30%, #4a148c 60%, #880e4f 100%);
  --footer-bg: #1e2a3a;        /* Footer background */
}
```

### Change Logo

Replace the text logo in the navbar:
```html
<a href="#" class="nav-logo">Your Brand Name</a>
```

Or replace with an image:
```html
<a href="#"><img src="your-logo.png" alt="Logo" height="40" /></a>
```

### Change Services/Content

All content is in plain HTML in `index.html`. Just edit the text in each section:
- **Stats**: Search for `stat-number` to change the numbers
- **Services**: Search for `service-card` to edit service cards
- **Testimonials**: Search for `testimonial-card` to edit quotes
- **Approach**: Search for `approach-card` to edit methodology steps

---

## 🔌 Backend API Reference

### Contact Form

| Method | Endpoint                  | Description              |
|--------|---------------------------|--------------------------|
| POST   | `/api/contact`            | Submit contact form      |
| GET    | `/api/contacts`           | List all submissions     |
| GET    | `/api/contacts/:id`       | Get single submission    |
| PUT    | `/api/contacts/:id/status`| Update status            |
| DELETE | `/api/contacts/:id`       | Delete submission        |
| GET    | `/api/stats`              | Dashboard statistics     |

### POST /api/contact

```json
{
  "name": "John Doe",
  "email": "john@company.com",
  "company": "Acme Corp",
  "phone": "+91 98765 43210",
  "message": "We need leadership training for 50 managers."
}
```

### GET /api/contacts

Query params: `?status=new&page=1&limit=20&search=keyword`

---

## 📧 Email Notifications (Optional)

To get email alerts when someone submits the form, edit `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NOTIFICATION_EMAIL=info@yourcompany.com
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833).

---

## 🌐 Deployment

### On EC2 / VPS

```bash
# 1. Clone/upload the project
# 2. Install Node.js (v18+)
# 3. Install dependencies
cd backend && npm install

# 4. Set up environment
cp .env .env.production
# Edit .env.production with your settings

# 5. Run with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name "synergy-website"
pm2 save
pm2 startup
```

### With Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🛡️ Security Notes

- Rate limiting is enabled (10 form submissions per 15 minutes per IP)
- Helmet.js is used for security headers
- Input validation on all form fields
- SQLite database stored locally (no external DB needed)
- For production: add authentication to admin API endpoints

---

## 📝 License

This is a template website. Customize and use for your own business.
