const { hashPassword, comparePassword } = require("../utils/hash");
const { generateToken } = require("../utils/token");
const userRepository = require("../repositories/userRepository");

class AuthService {
  async register(email, password, full_name) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw new Error("Email already registered");

    const hashedPassword = await hashPassword(password);

    const newUser = await userRepository.create({
      email,
      password_hash: hashedPassword,
      full_name,
      provider: "local",
    });

    const token = generateToken({
      id: newUser._id,
      email: newUser.email,
      role: newUser.role,
    });

    return {
      message: "User registered successfully",
      user: {
        id: newUser._id,
        email: newUser.email,
        full_name: newUser.full_name,
      },
      token,
    };
  }

  async login(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error("Invalid email or password");

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) throw new Error("Invalid email or password");

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    return {
      message: "Login successful",
      user: { id: user._id, email: user.email, full_name: user.full_name },
      token,
    };
  }
}

module.exports = new AuthService();
