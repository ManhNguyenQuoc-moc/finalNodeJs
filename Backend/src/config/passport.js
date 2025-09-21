const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            user.googleId = profile.id;
            user.is_verified = true;
            await user.save();
          } else {
            user = await User.create({
              email: profile.emails[0].value,
              full_name: profile.displayName,
              googleId: profile.id,
              provider: "google",
              is_verified: true,
            });
          }
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: process.env.FACEBOOK_REDIRECT_URI,
      profileFields: ["id", "emails", "name", "displayName"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ facebookId: profile.id });

        if (!user) {
          // fallback nếu không có email
          const email = profile.emails && profile.emails[0]?.value;

          if (email) {
            // Nếu có email → check xem đã có user local/google chưa
            user = await User.findOne({ email });

            if (user) {
              user.facebookId = profile.id;
              await user.save();
            } else {
              user = await User.create({
                email,
                full_name: profile.displayName,
                facebookId: profile.id,
                provider: "facebook",
                is_verified: true,
              });
            }
          } else {
            // Nếu không có email → tạo user với email=null
            user = await User.create({
              email: null,
              full_name: profile.displayName,
              facebookId: profile.id,
              provider: "facebook",
              is_verified: true,
            });
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;
