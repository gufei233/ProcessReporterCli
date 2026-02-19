const { cpSync, copyFileSync, mkdirSync, existsSync } = require("fs")
const { execSync } = require("child_process")
const path = require("path")

// Copy sqlite3 native bindings
const bindingDir = path.join(__dirname, "./node_modules/sqlite3/build")
cpSync(bindingDir, path.join(__dirname, "./dist/build"), {
  recursive: true,
  overwrite: true,
})

// Copy .env.example for distribution (NOT .env — avoid leaking credentials)
const envExample = path.join(__dirname, ".env.example")
if (existsSync(envExample)) {
  copyFileSync(envExample, path.join(__dirname, "./dist/.env.example"))
}

// Copy .env only if dist doesn't already have one (don't overwrite user config)
const envFile = path.join(__dirname, ".env")
const distEnv = path.join(__dirname, "./dist/.env")
if (existsSync(envFile) && !existsSync(distEnv)) {
  copyFileSync(envFile, distEnv)
}

// Copy systray2 tray binary
const systrayBinDir = path.join(__dirname, "./node_modules/systray2/traybin")
if (existsSync(systrayBinDir)) {
  const destTrayDir = path.join(__dirname, "./dist/traybin")
  mkdirSync(destTrayDir, { recursive: true })
  cpSync(systrayBinDir, destTrayDir, {
    recursive: true,
    overwrite: true,
  })
}

// Build and publish C# media-helper
const mediaHelperDir = path.join(__dirname, "./scripts/media-helper")
const destScriptsDir = path.join(__dirname, "./dist/scripts")
mkdirSync(destScriptsDir, { recursive: true })
if (existsSync(path.join(mediaHelperDir, "media-helper.csproj"))) {
  try {
    console.log("Building media-helper.exe...")
    execSync(
      `dotnet publish -c Release -o "${destScriptsDir}"`,
      { cwd: mediaHelperDir, stdio: "inherit" }
    )
    console.log("media-helper.exe built successfully")
  } catch (err) {
    console.error("Failed to build media-helper.exe:", err.message)
    console.error("Media detection will not work. Ensure .NET 8 SDK is installed.")
  }
}

// Copy start.bat
const startBat = path.join(__dirname, "start.bat")
if (existsSync(startBat)) {
  copyFileSync(startBat, path.join(__dirname, "./dist/start.bat"))
}

// Copy resources (icon) if present
const resourcesDir = path.join(__dirname, "./resources")
if (existsSync(resourcesDir)) {
  const destResourcesDir = path.join(__dirname, "./dist/resources")
  mkdirSync(destResourcesDir, { recursive: true })
  cpSync(resourcesDir, destResourcesDir, {
    recursive: true,
    overwrite: true,
  })
}
