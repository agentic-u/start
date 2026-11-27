import profile from "./effect-tsconfig.json" with { type: "json" };

interface ApiAdmission {
  readonly allowedExperimentalApis: readonly string[];
  readonly allowedUnstableApis: readonly string[];
}

export const effectCompilerOptions = (admission: ApiAdmission) => ({
  ...profile.compilerOptions,
  plugins: profile.compilerOptions.plugins.map((plugin) => ({
    ...plugin,
    ...admission,
  })),
});
