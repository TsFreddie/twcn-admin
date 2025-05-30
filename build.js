#!/usr/bin/env node

/**
 * Build script for TeeworldsCN Admin NW.js application
 * Builds for Linux and Windows platforms using nw-builder
 */

import nwbuild from "nw-builder";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from main.js
const mainJsContent = fs.readFileSync(
  path.join(__dirname, "src/js/main.js"),
  "utf8"
);
const versionMatch = mainJsContent.match(/const VERSION = ["'](.+?)["'];/);
const VERSION = versionMatch ? versionMatch[1] : "X.X";

// Configuration
const CONFIG = {
  // Source directory containing the NW.js app
  srcDir: "./src",

  // Output directory for built applications
  outDir: "./dist",

  // Cache directory for NW.js binaries
  cacheDir: "./cache",

  // NW.js version to use
  version: "0.100.0",

  // Platforms to build for
  platforms: ["linux-x64", "win-x64"],

  // Build flavor (sdk for development, normal for production)
  flavor: "normal",

  // Whether to zip the output
  zip: true,

  // Application metadata
  appName: "TeeworldsCN-Admin",
  appVersion: VERSION,
};

/**
 * Utility functions
 */
function log(message, type = "info") {
  const timestamp = new Date().toISOString();
  const prefix =
    {
      info: "📦",
      success: "✅",
      error: "❌",
      warning: "⚠️",
    }[type] || "ℹ️";

  console.log(`${prefix} [${timestamp}] ${message}`);
}

log(`Building TeeworldsCN Admin v${VERSION}...`);

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`);
  }
}

function cleanDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    log(`Cleaned directory: ${dirPath}`);
  }
}

/**
 * Validate build environment
 */
function validateEnvironment() {
  log("Validating build environment...");

  // Check if source directory exists
  if (!fs.existsSync(CONFIG.srcDir)) {
    throw new Error(`Source directory not found: ${CONFIG.srcDir}`);
  }

  // Check if package.json exists in source directory
  const packageJsonPath = path.join(CONFIG.srcDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(
      `package.json not found in source directory: ${packageJsonPath}`
    );
  }

  // Check if main entry file exists
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const mainFile = path.join(CONFIG.srcDir, packageJson.main || "index.js");
  if (!fs.existsSync(mainFile)) {
    throw new Error(`Main entry file not found: ${mainFile}`);
  }

  log("Environment validation passed ✓");
}

/**
 * Install dependencies in source directory
 */
async function installDependencies() {
  log("Installing dependencies in source directory...");

  const srcPackageJsonPath = path.join(CONFIG.srcDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(srcPackageJsonPath, "utf8"));

  if (
    packageJson.dependencies &&
    Object.keys(packageJson.dependencies).length > 0
  ) {
    try {
      // Change to source directory and install dependencies
      process.chdir(CONFIG.srcDir);
      execSync("npm install --omit=dev", { stdio: "inherit" });
      process.chdir("..");
      log("Dependencies installed successfully ✓");
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  } else {
    log("No dependencies to install");
  }
}

/**
 * Create build configuration for nw-builder
 */
function createBuildConfig(platform) {
  // Extract platform and arch from platform string (e.g., 'linux-x64' -> 'linux', 'x64')
  const [platformName, arch] = platform.split("-");

  // Create platform-specific output directory
  const platformOutDir = path.join(CONFIG.outDir, platform);

  return {
    mode: "build",
    srcDir: CONFIG.srcDir,
    outDir: platformOutDir,
    cacheDir: CONFIG.cacheDir,
    version: CONFIG.version,
    platform: platformName,
    arch: arch,
    flavor: CONFIG.flavor,
    zip: CONFIG.zip,
    glob: false,

    // Platform-specific app configurations
    app:
      platformName === "win"
        ? {
            name: CONFIG.appName,
            icon: path.join(__dirname, "icon.ico"),
            version: CONFIG.appVersion,
            productName: "TeeworldsCN 管理系统",
            fileDescription: "TeeworldsCN 管理系统",
            company: "TeeworldsCN",
            legalCopyright: "© 2024 TeeworldsCN",
          }
        : platformName === "linux"
        ? {
            name: CONFIG.appName,
            genericName: "TeeworldsCN Admin",
            comment: "TeeworldsCN 管理系统",
            categories: ["Network", "Office"],
          }
        : {},
  };
}

/**
 * Build the application
 */
async function buildApplication() {
  log("Starting build process...");

  try {
    log(`Building for platforms: ${CONFIG.platforms.join(", ")}`);
    log(`NW.js version: ${CONFIG.version}`);
    log(`Build flavor: ${CONFIG.flavor}`);

    // Build for each platform separately
    for (const platform of CONFIG.platforms) {
      log(`Building for ${platform}...`);

      // Create platform-specific output directory
      const platformOutDir = path.join(CONFIG.outDir, platform);
      ensureDirectoryExists(platformOutDir);

      const buildConfig = createBuildConfig(platform);

      // Use nwbuild function directly (new API)
      await nwbuild(buildConfig);

      log(`✓ Build completed for ${platform}`, "success");
      log(`📁 Output: ${path.resolve(platformOutDir)}`);
    }

    log("All builds completed successfully! ✓", "success");

    // List built files
    listBuiltFiles();
  } catch (error) {
    log(`Build failed: ${error.message}`, "error");
    throw error;
  }
}

/**
 * List built files in the output directory
 */
function listBuiltFiles() {
  log("Built files:");

  if (!fs.existsSync(CONFIG.outDir)) {
    log("No output directory found", "warning");
    return;
  }

  // List platform directories
  const platformDirs = fs.readdirSync(CONFIG.outDir);
  platformDirs.forEach((platformDir) => {
    const platformPath = path.join(CONFIG.outDir, platformDir);
    const stats = fs.statSync(platformPath);

    if (stats.isDirectory()) {
      log(`  📁 ${platformDir}/`);

      // List files in platform directory
      try {
        const files = fs.readdirSync(platformPath);
        files.forEach((file) => {
          const filePath = path.join(platformPath, file);
          const fileStats = fs.statSync(filePath);
          const size = fileStats.isFile()
            ? `(${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`
            : "";
          const icon = fileStats.isDirectory() ? "📁" : "📄";
          log(`    ${icon} ${file} ${size}`);
        });
      } catch (error) {
        log(
          `    ⚠️  Could not read directory contents: ${error.message}`,
          "warning"
        );
      }
    } else {
      // Handle any files in the root dist directory
      const size = `(${(stats.size / 1024 / 1024).toFixed(2)} MB)`;
      log(`  📄 ${platformDir} ${size}`);
    }
  });
}

/**
 * Main build function
 */
async function main() {
  const startTime = Date.now();

  try {
    log("🚀 Starting TeeworldsCN Admin build process...");

    // Parse command line arguments
    const args = process.argv.slice(2);
    const cleanBuild = args.includes("--clean");
    const devBuild = args.includes("--dev");

    // Update config based on arguments
    if (devBuild) {
      CONFIG.flavor = "sdk";
      CONFIG.zip = false;
      log("Development build enabled (SDK flavor, no compression)");
    }

    // Clean output directory if requested
    if (cleanBuild) {
      log("Clean build requested");
      cleanDirectory(CONFIG.outDir);
      cleanDirectory(CONFIG.cacheDir);
    }

    // Ensure directories exist
    ensureDirectoryExists(CONFIG.outDir);
    ensureDirectoryExists(CONFIG.cacheDir);

    // Validate environment
    validateEnvironment();

    // Install dependencies
    await installDependencies();

    // Build application
    await buildApplication();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log(`🎉 Build completed successfully in ${duration} seconds!`, "success");
    log(`📦 Output directory: ${path.resolve(CONFIG.outDir)}`);
    log(`📁 Platform builds:`);
    CONFIG.platforms.forEach((platform) => {
      const platformPath = path.join(CONFIG.outDir, platform);
      log(`   ${platform}: ${path.resolve(platformPath)}`);
    });
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, "error");
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  log(`Uncaught exception: ${error.message}`, "error");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  log(`Unhandled rejection at ${promise}: ${reason}`, "error");
  process.exit(1);
});

main();
