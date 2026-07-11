const auth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Token yok" });
  }

  try {
    const verified = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET || "secretkey");
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: "Geçersiz token" });
  }
};