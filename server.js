require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const { InferenceClient } = require("@huggingface/inference");
const axios = require("axios");
const cheerio = require("cheerio");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
const { Resend } = require("resend");
const crypto = require("crypto");

const User = require("./models/User");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ===================== SESSION & PASSPORT =====================
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* =====================
   MONGODB
===================== */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB bağlandı"))
  .catch((err) => console.log("❌ MongoDB hata:", err.message));

/* =====================
   OTP MODEL
===================== */
const OtpSchema = new mongoose.Schema({
  email:     { type: String, required: true },
  code:      { type: String, required: true },
  expiresAt: { type: Date,   required: true },
  createdAt: { type: Date,   default: Date.now },
});
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Otp = mongoose.model("Otp", OtpSchema);

/* =====================
   PROJECT MODEL
===================== */
const ProjectSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name:      { type: String, required: true },
  effect:    String,
  frame:     String,
  sliders:   Object,
  thumb:     String,
  createdAt: { type: Date, default: Date.now },
});
const Project = mongoose.model("Project", ProjectSchema);

/* =====================
   CHAT MESSAGE MODEL
===================== */
const ChatMessageSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  conversationId: { type: String, required: true, index: true },
  role:           { type: String, enum: ["user", "assistant"], required: true },
  content:        { type: String, required: true },
  image:          String,
  section:        String,
  createdAt:      { type: Date, default: Date.now },
});
const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);

/* =====================
   RESEND (E-POSTA GÖNDERİMİ)
   .env dosyasına şunu ekleyin:
     RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
     MAIL_FROM="fotoAI PRO <onboarding@resend.dev>"

   Not: Kendi domaininizi Resend'e doğrulatmadan önce
   sadece "onboarding@resend.dev" gönderen adresi çalışır.
   Kendi domaininizi doğrulattıktan sonra MAIL_FROM'u
   "fotoAI PRO <bildirim@sizin-domaininiz.com>" olarak değiştirebilirsiniz.
===================== */
const resend = new Resend(process.env.RESEND_API_KEY);
const MAIL_FROM = process.env.MAIL_FROM || "fotoAI PRO <onboarding@resend.dev>";

async function sendOtpEmail(email, code) {
  try {
    const { data, error } = await resend.emails.send({
      from: MAIL_FROM,
      to: email,
      subject: "fotoAI PRO – E-posta Doğrulama Kodu",
      html: `
        <div style="font-family:'Segoe UI',sans-serif;background:#0e0e14;color:#e8e8f0;padding:40px;border-radius:12px;max-width:480px;margin:auto">
          <h2 style="color:#a89ef7;margin-bottom:4px">foto<span style="color:#7c6ef0">AI</span> <sup style="font-size:11px">PRO</sup></h2>
          <p style="color:#9090aa;font-size:13px;margin-top:0">Yapay zeka destekli fotoğraf editörü</p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:20px 0">
          <p style="font-size:14px;margin-bottom:6px">Hesabınızı doğrulamak için aşağıdaki 6 haneli kodu girin:</p>
          <div style="text-align:center;margin:28px 0">
            <span style="display:inline-block;background:#1e1e2c;border:2px solid #7c6ef0;border-radius:10px;padding:18px 38px;font-size:36px;font-weight:700;letter-spacing:10px;color:#a89ef7">${code}</span>
          </div>
          <p style="font-size:12px;color:#5a5a70">Bu kod <strong style="color:#9090aa">10 dakika</strong> geçerlidir. Eğer kayıt olmaya çalışmadıysanız bu e-postayı yoksayın.</p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:20px 0">
          <p style="font-size:11px;color:#3a3a50;text-align:center">© fotoAI PRO – Tüm hakları saklıdır</p>
        </div>
      `,
    });

    if (error) throw new Error(error.message || JSON.stringify(error));

    console.log("✅ OTP maili gönderildi →", email, "| id:", data?.id);
  } catch (err) {
    console.error("❌ OTP mail gönderilemedi →", email);
    console.error("   Hata:", err.message);
    // Hatayı yukarı fırlat ki register route 500 dönsün
    throw new Error("E-posta gönderilemedi: " + err.message);
  }
}

async function sendResetOtpEmail(email, code) {
  try {
    const { data, error } = await resend.emails.send({
      from: MAIL_FROM,
      to: email,
      subject: "fotoAI PRO – Şifre Sıfırlama Kodu",
      html: `
        <div style="font-family:'Segoe UI',sans-serif;background:#0e0e14;color:#e8e8f0;padding:40px;border-radius:12px;max-width:480px;margin:auto">
          <h2 style="color:#a89ef7;margin-bottom:4px">foto<span style="color:#7c6ef0">AI</span> <sup style="font-size:11px">PRO</sup></h2>
          <p style="color:#9090aa;font-size:13px;margin-top:0">Şifre sıfırlama isteği</p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:20px 0">
          <p style="font-size:14px;margin-bottom:6px">Şifrenizi sıfırlamak için aşağıdaki 6 haneli kodu girin:</p>
          <div style="text-align:center;margin:28px 0">
            <span style="display:inline-block;background:#1e1e2c;border:2px solid #7c6ef0;border-radius:10px;padding:18px 38px;font-size:36px;font-weight:700;letter-spacing:10px;color:#a89ef7">${code}</span>
          </div>
          <p style="font-size:12px;color:#5a5a70">Bu kod <strong style="color:#9090aa">10 dakika</strong> geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yoksayın, şifreniz değişmeyecektir.</p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:20px 0">
          <p style="font-size:11px;color:#3a3a50;text-align:center">© fotoAI PRO – Tüm hakları saklıdır</p>
        </div>
      `,
    });

    if (error) throw new Error(error.message || JSON.stringify(error));

    console.log("✅ Reset OTP maili gönderildi →", email, "| id:", data?.id);
  } catch (err) {
    console.error("❌ Reset OTP mail gönderilemedi →", email, err.message);
    throw new Error("E-posta gönderilemedi: " + err.message);
  }
}

/* =====================
   AUTH MIDDLEWARE
===================== */
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Token yok" });
  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Geçersiz token" });
  }
};

// Token varsa doğrular, yoksa hata vermeden devam eder (misafir kullanım için)
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (header) {
    try {
      const token = header.split(" ")[1];
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {}
  }
  next();
};

/* =====================
   HOME
===================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =====================
   GOOGLE OAUTH
===================== */
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  "https://fotoai-pro.onrender.com/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
          user = await User.create({
            firstName: profile.name.givenName || "Google User",
            lastName:  profile.name.familyName || "",
            email:     profile.emails[0].value,
            password:  "google-auth",
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/" }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    res.redirect(`/editor.html?token=${token}`);
  }
);

/* =====================
   REGISTER  (Adım 1 – OTP gönder)
===================== */
app.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "Tüm alanları doldurun" });

    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ message: "Bu e-posta zaten kayıtlı" });

    // Önceki OTP'leri temizle
    await Otp.deleteMany({ email });

    // 6 haneli kod üret
    const code = crypto.randomInt(100000, 999999).toString();

    await Otp.create({
      email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log("🔑 OTP KODU →", email, "→", code);

    // Kullanıcı bilgilerini JWT içinde taşı (henüz DB'ye kaydetme)
    const pendingToken = jwt.sign(
      { firstName, lastName, email, password },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Maili gönder — hata fırlarsa catch bloğu 500 döner
    await sendOtpEmail(email, code);

    res.json({
      success: true,
      message: "Doğrulama kodu e-postanıza gönderildi",
      pendingToken,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================
   VERIFY OTP  (Adım 2 – Doğrula ve hesabı oluştur)
===================== */
app.post("/verify-otp", async (req, res) => {
  try {
    const { pendingToken, code } = req.body;

    if (!pendingToken || !code)
      return res.status(400).json({ message: "Eksik bilgi" });

    let pending;
    try {
      pending = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Oturum süresi doldu, yeniden kayıt olun" });
    }

    const { firstName, lastName, email, password } = pending;

    const otpDoc = await Otp.findOne({ email, code });
    if (!otpDoc)
      return res.status(400).json({ message: "Kod yanlış veya süresi dolmuş" });
    if (otpDoc.expiresAt < new Date())
      return res.status(400).json({ message: "Kodun süresi doldu, yeni kod isteyin" });

    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ message: "Bu e-posta zaten kayıtlı" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ firstName, lastName, email, password: hashed });

    await Otp.deleteMany({ email });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================
   RESEND OTP (kod tekrar gönderme, e-posta yeniden gönderim rotası)
===================== */
app.post("/resend-otp", async (req, res) => {
  try {
    const { pendingToken } = req.body;

    let pending;
    try {
      pending = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Oturum süresi doldu, yeniden kayıt olun" });
    }

    const { email } = pending;
    await Otp.deleteMany({ email });

    const code = crypto.randomInt(100000, 999999).toString();
    await Otp.create({ email, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    console.log("🔑 OTP KODU (resend) →", email, "→", code);

    await sendOtpEmail(email, code);

    res.json({ success: true, message: "Yeni kod gönderildi" });
  } catch (err) {
    console.error("RESEND OTP ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================
   LOGIN
===================== */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Kullanıcı bulunamadı" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Şifre yanlış" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24d" }
    );
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================
   FORGOT PASSWORD (Adım 1 – OTP gönder)
===================== */
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "E-posta gerekli" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Bu e-posta ile kayıtlı kullanıcı bulunamadı" });

    await Otp.deleteMany({ email });
    const code = crypto.randomInt(100000, 999999).toString();
    await Otp.create({ email, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    console.log("🔑 RESET OTP KODU →", email, "→", code);

    const pendingToken = jwt.sign(
      { email, purpose: "reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    await sendResetOtpEmail(email, code);

    res.json({ success: true, message: "Doğrulama kodu e-postanıza gönderildi", pendingToken });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================
   RESEND RESET OTP
===================== */
app.post("/resend-reset-otp", async (req, res) => {
  try {
    const { pendingToken } = req.body;
    let pending;
    try {
      pending = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Oturum süresi doldu, yeniden deneyin" });
    }
    if (pending.purpose !== "reset")
      return res.status(400).json({ message: "Geçersiz istek" });

    const { email } = pending;
    await Otp.deleteMany({ email });
    const code = crypto.randomInt(100000, 999999).toString();
    await Otp.create({ email, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    console.log("🔑 RESET OTP KODU (resend) →", email, "→", code);

    await sendResetOtpEmail(email, code);

    res.json({ success: true, message: "Yeni kod gönderildi" });
  } catch (err) {
    console.error("RESEND RESET OTP ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================
   RESET PASSWORD (Adım 2 – Doğrula ve şifreyi güncelle)
===================== */
app.post("/reset-password", async (req, res) => {
  try {
    const { pendingToken, code, newPassword } = req.body;
    if (!pendingToken || !code || !newPassword)
      return res.status(400).json({ message: "Eksik bilgi" });
    if (newPassword.length < 8)
      return res.status(400).json({ message: "Şifre en az 8 karakter olmalı" });

    let pending;
    try {
      pending = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Oturum süresi doldu, yeniden deneyin" });
    }
    if (pending.purpose !== "reset")
      return res.status(400).json({ message: "Geçersiz istek" });

    const { email } = pending;
    const otpDoc = await Otp.findOne({ email, code });
    if (!otpDoc) return res.status(400).json({ message: "Kod yanlış veya süresi dolmuş" });
    if (otpDoc.expiresAt < new Date())
      return res.status(400).json({ message: "Kodun süresi doldu, yeni kod isteyin" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Kullanıcı bulunamadı" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await Otp.deleteMany({ email });

    res.json({ success: true, message: "Şifreniz başarıyla güncellendi" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================
   PROFILE
===================== */
app.get("/profile", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ success: true, user });
});

/* PROFILE UPDATE — Ad/Soyad/E-posta/Biyografi kalıcı kaydetme (YENİ) */
app.put("/profile", auth, async (req, res) => {
  try {
    const { firstName, lastName, email, bio } = req.body;

    if (!firstName || !firstName.trim())
      return res.status(400).json({ message: "Ad boş olamaz" });

    // E-posta değiştiriliyorsa, başka bir kullanıcı tarafından kullanılmadığından emin ol
    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existing)
        return res.status(400).json({ message: "Bu e-posta başka bir hesap tarafından kullanılıyor" });
    }

    const update = { firstName: firstName.trim() };
    if (lastName !== undefined) update.lastName = lastName.trim();
    if (email !== undefined && email.trim()) update.email = email.trim();
    if (bio !== undefined) update.bio = bio;

    const user = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    res.json({ success: true, user });
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err.message);
    res.status(500).json({ success: false, message: "Profil güncellenemedi", error: err.message });
  }
});

/* =====================
   PROJECTS
===================== */
app.post("/projects", auth, async (req, res) => {
  const { name, effect, frame, sliders, thumb } = req.body;
  const project = await Project.create({ userId: req.user.id, name, effect, frame, sliders, thumb });
  res.json({ success: true, project });
});

app.get("/projects", auth, async (req, res) => {
  const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json({ success: true, projects });
});

app.delete("/projects/:id", auth, async (req, res) => {
  await Project.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ success: true, message: "Silindi" });
});

/* =====================
   CHAT HISTORY
===================== */
/* Kullanıcının tüm geçmiş sohbetlerinin LİSTESİ (ChatGPT tarzı) */
app.get("/chat/conversations", auth, async (req, res) => {
  try {
    const conversations = await ChatMessage.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$conversationId",
          firstMessage: { $first: "$content" },
          firstRole: { $first: "$role" },
          lastMessage: { $last: "$content" },
          messageCount: { $sum: 1 },
          startedAt: { $first: "$createdAt" },
          updatedAt: { $last: "$createdAt" },
        },
      },
      { $sort: { updatedAt: -1 } },
      { $limit: 100 },
    ]);

    const list = conversations.map((c) => ({
      conversationId: c._id,
      title:
        (c.firstRole === "user" ? c.firstMessage : c.lastMessage || "Sohbet").slice(0, 60) ||
        "Yeni sohbet",
      messageCount: c.messageCount,
      startedAt: c.startedAt,
      updatedAt: c.updatedAt,
    }));

    res.json({ success: true, conversations: list });
  } catch (err) {
    console.error("CHAT CONVERSATIONS ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* Tek bir sohbetin tüm mesajlarını getir */
app.get("/chat/history/:conversationId", auth, async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      userId: req.user.id,
      conversationId: req.params.conversationId,
    })
      .sort({ createdAt: 1 })
      .limit(500);
    res.json({ success: true, messages });
  } catch (err) {
    console.error("CHAT HISTORY ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* Geriye dönük uyumluluk: parametresiz istekte en son sohbeti döndür */
app.get("/chat/history", auth, async (req, res) => {
  try {
    const last = await ChatMessage.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
    if (!last) return res.json({ success: true, messages: [] });
    const messages = await ChatMessage.find({
      userId: req.user.id,
      conversationId: last.conversationId,
    }).sort({ createdAt: 1 });
    res.json({ success: true, messages, conversationId: last.conversationId });
  } catch (err) {
    console.error("CHAT HISTORY ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* Belirli bir sohbeti tamamen sil */
app.delete("/chat/conversations/:conversationId", auth, async (req, res) => {
  try {
    await ChatMessage.deleteMany({ userId: req.user.id, conversationId: req.params.conversationId });
    res.json({ success: true, message: "Sohbet silindi" });
  } catch (err) {
    console.error("CHAT CONVERSATION DELETE ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* Kullanıcının TÜM sohbetlerini sil */
app.delete("/chat/history", auth, async (req, res) => {
  try {
    await ChatMessage.deleteMany({ userId: req.user.id });
    res.json({ success: true, message: "Sohbet geçmişi silindi" });
  } catch (err) {
    console.error("CHAT HISTORY DELETE ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================
   AI IMAGE
===================== */
app.post("/generate-image", auth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt gerekli" });

    const client = new InferenceClient(process.env.HF_TOKEN);
    const output = await client.textToImage({
      provider: "replicate",
      model: "black-forest-labs/FLUX.1-dev",
      inputs: prompt,
    });

    const arrayBuffer = await output.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    res.json({ success: true, image: `data:image/png;base64,${base64}` });
  } catch (err) {
    console.error("HF ERROR:", err.message);
    res.status(500).json({ success: false, error: "AI çalışmadı", detail: err.message });
  }
});

/* =====================
   REAL WEB + IMAGE SEARCH (DuckDuckGo tabanlı, API anahtarı gerektirmez)
===================== */
async function ddgWebSearch(query, limit = 8) {
  const { data: html } = await axios.get("https://html.duckduckgo.com/html/", {
    params: { q: query },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    timeout: 10000,
  });
  const $ = cheerio.load(html);
  const results = [];
  $(".result").each((i, el) => {
    if (results.length >= limit) return;
    const titleEl = $(el).find(".result__title a");
    const title = titleEl.text().trim();
    let url = titleEl.attr("href") || "";
    // DuckDuckGo yönlendirme linklerini çöz (uddg parametresi gerçek URL'yi taşır)
    const m = url.match(/uddg=([^&]+)/);
    if (m) url = decodeURIComponent(m[1]);
    const snippet = $(el).find(".result__snippet").text().trim();
    if (title && url) results.push({ title, url, snippet });
  });
  return results;
}

async function ddgImageSearch(query, limit = 12) {
  // 1. Adım: vqd jetonunu al (DuckDuckGo görsel aramasının gerektirdiği token)
  const tokenRes = await axios.get("https://duckduckgo.com/", {
    params: { q: query },
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 10000,
  });
  const vqdMatch = tokenRes.data.match(/vqd=['"]?([\d-]+)['"]?/);
  if (!vqdMatch) throw new Error("Görsel arama jetonu alınamadı");
  const vqd = vqdMatch[1];

  // 2. Adım: görsel sonuçlarını çek
  const imgRes = await axios.get("https://duckduckgo.com/i.js", {
    params: { l: "us-en", o: "json", q: query, vqd, f: ",,,", p: "1" },
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://duckduckgo.com/",
    },
    timeout: 10000,
  });
  const items = (imgRes.data && imgRes.data.results) || [];
  return items.slice(0, limit).map((it) => ({
    title: it.title,
    image: it.image,
    thumbnail: it.thumbnail,
    source: it.url,
  }));
}

app.post("/search-real", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim())
      return res.status(400).json({ success: false, message: "Arama sorgusu gerekli" });

    const [webResults, imageResults] = await Promise.allSettled([
      ddgWebSearch(query, 8),
      ddgImageSearch(query, 12),
    ]);

    res.json({
      success: true,
      query,
      results: webResults.status === "fulfilled" ? webResults.value : [],
      images: imageResults.status === "fulfilled" ? imageResults.value : [],
      webError: webResults.status === "rejected" ? webResults.reason.message : null,
      imageError: imageResults.status === "rejected" ? imageResults.reason.message : null,
    });
  } catch (err) {
    console.error("SEARCH REAL ERROR:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================
   CHAT
===================== */
const IMAGE_INTENT_REGEX =
  /(görsel|resim|fotoğraf|image|picture)\s*(oluştur|üret|yap|çiz|generate|create)|(\boluştur\b|\büret\b)\s*(görsel|resim|fotoğraf)/i;

app.post("/chat", optionalAuth, async (req, res) => {
  try {
    const { messages, systemPrompt, section } = req.body;
    if (!messages || !Array.isArray(messages) || !messages.length)
      return res.status(400).json({ message: "messages gerekli" });

    // Sohbeti gruplamak için conversationId — client göndermezse yeni bir tane üret
    let conversationId = req.body.conversationId;
    if (req.user && !conversationId) {
      conversationId = crypto.randomUUID();
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const wantsImage = lastUserMsg && IMAGE_INTENT_REGEX.test(lastUserMsg.content || "");

    // Kullanıcı giriş yapmışsa mesajları veritabanına kaydet
    async function saveMsg(role, content, image) {
      if (!req.user) return;
      try {
        await ChatMessage.create({ userId: req.user.id, conversationId, role, content, image, section });
      } catch (e) {
        console.error("CHAT SAVE ERROR:", e.message);
      }
    }

    if (lastUserMsg) await saveMsg("user", lastUserMsg.content);

    if (wantsImage) {
      try {
        const client = new InferenceClient(process.env.HF_TOKEN);
        const output = await client.textToImage({
          provider: "replicate",
          model: "black-forest-labs/FLUX.1-dev",
          inputs: lastUserMsg.content,
        });
        const arrayBuffer = await output.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const imageData = `data:image/png;base64,${base64}`;
        await saveMsg("assistant", "İşte istediğin görsel! 🎨", imageData);
        return res.json({
          success: true,
          reply: "İşte istediğin görsel! 🎨",
          image: imageData,
          conversationId,
        });
      } catch (imgErr) {
        const errReply = "Görsel üretmeye çalıştım ama bir sorun oluştu: " + imgErr.message;
        await saveMsg("assistant", errReply);
        return res.json({
          success: true,
          reply: errReply,
          conversationId,
        });
      }
    }

    const groqRes = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt || "Sen yardımsever bir asistansın." },
          ...messages,
        ],
        max_tokens: 1000,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const reply = groqRes.data?.choices?.[0]?.message?.content || "Yanıt alınamadı.";
    await saveMsg("assistant", reply);
    res.json({ success: true, reply, conversationId });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("CHAT ERROR:", detail);
    res.status(500).json({ success: false, error: "Sohbet çalışmadı", detail });
  }
});

/* =====================
   START
===================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server http://localhost:${PORT}`));