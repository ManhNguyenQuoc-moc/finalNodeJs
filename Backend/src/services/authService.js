const { hashPassword, comparePassword } = require("../utils/hash");
const addressRepository = require("../repositories/addressRepository");
const { generateToken } = require("../utils/token");
const userRepository = require("../repositories/userRepository");
const { verifyToken } = require("../utils/token");
const sendEmail = require("../utils/email");
const verifyEmailTemplate = require("../utils/verifyEmailTemplate");
class authService {
  async register(email, full_name, address_line) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error("Email already registered");
    }

    const verificationToken = generateToken({ email }, "10m");

    const newUser = await userRepository.create({
      email,
      full_name,
      provider: "local",
      is_verified: false,
      verification_token: verificationToken,
      verification_expires: new Date(Date.now() + 10 * 60 * 1000), // 10 phút
    });

    const verifyLink = `http://localhost:3000/verify-account?token=${verificationToken}&address=${encodeURIComponent(
      address_line
    )}`;
    const htmlContent = verifyEmailTemplate({ full_name, verifyLink });
    await sendEmail(
      email,
      "E-Shop - Verify Your Email",
      htmlContent
    );

    return {
      message:
        "Registration successful. Please check your email to verify your account.",
      userId: newUser._id,
    };
  }

  async verifyEmail(token, address_line) {
    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error("Invalid or expired verification token");
    }

    const user = await userRepository.findByEmail(decoded.email);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.is_verified) {
      return { message: "Email already verified" };
    }

    user.is_verified = true;
    user.verification_token = null;
    user.verification_expires = null;
    await user.save();

    const newAddress = await addressRepository.create({
      user: user._id,
      address_line,
      is_default: true,
    });

    return {
      message: "Email verified successfully. Please set your password.",
      userId: user._id,
      address: {
        id: newAddress._id,
        address_line: newAddress.address_line,
        is_default: newAddress.is_default,
      },
    };
  }

  async setPassword(userId, newPassword) {
    const hashedPassword = await hashPassword(newPassword);
    const user = await userRepository.findById(userId);

    if (!user) throw new Error("User not found");
    if (!user.is_verified) throw new Error("User not verified yet");

    user.password_hash = hashedPassword;
    await user.save();

    const accessToken = generateToken(
      { id: user._id, email: user.email, role: user.role },
      "1h"
    );

    const refreshToken = generateToken(
      { id: user._id, email: user.email },
      "7d"
    );

    user.refresh_token = refreshToken;
    await user.save();

    return {
      message: "Password set successfully. You are now logged in.",
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
      },
    };
  }

  async login(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw new Error("Invalid email or password");
    }

    const accessToken = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateToken(
      { id: user._id, email: user.email },
      "7d"
    );

    await userRepository.updateById(user._id, { refresh_token: refreshToken });

    return {
      message: "Login successful",
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
      },
    };
  }

  async refresh(refreshToken) {
    if (!refreshToken) throw new Error("No refresh token provided");

    const decoded = verifyToken(refreshToken);
    if (!decoded) throw new Error("Invalid or expired refresh token");

    const user = await userRepository.findByEmail(decoded.email);
    if (!user || user.refresh_token !== refreshToken) {
      throw new Error("Refresh token not valid");
    }

    const newAccessToken = generateToken(
      { id: user._id, email: user.email, role: user.role },
      "1h"
    );

    return { accessToken: newAccessToken };
  }

  async logout(userId) {
    await userRepository.updateById(userId, { refresh_token: null });
    return { message: "Logged out successfully" };
  }

  async socialLogin(user) {
    const accessToken = generateToken(
      { id: user._id, email: user.email, role: user.role },
      "1h"
    );
    const refreshToken = generateToken(
      { id: user._id, email: user.email },
      "7d"
    );

    user.refresh_token = refreshToken;
    await user.save();

    return {
      message: "Social login successful",
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
      },
    };
  }
}

module.exports = new authService();
