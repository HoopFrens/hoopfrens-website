export type ProjectArtifact = { projectId: string };

export type ProjectScopedArtifact<TArtifact extends ProjectArtifact> = {
  projectId: string;
  artifact: TArtifact | null;
};

export function scopeArtifactResponse<TArtifact extends ProjectArtifact>(
  requestProjectId: string,
  selectedProjectId: string | null,
  artifact: TArtifact | null,
): ProjectScopedArtifact<TArtifact> | null {
  if (requestProjectId !== selectedProjectId) return null;
  if (artifact && artifact.projectId !== requestProjectId) return null;
  return { projectId: requestProjectId, artifact };
}

export function artifactForProject<TArtifact extends ProjectArtifact>(
  scopedArtifact: ProjectScopedArtifact<TArtifact> | null,
  projectId: string | null,
) {
  if (!scopedArtifact || !projectId || scopedArtifact.projectId !== projectId) return null;
  if (scopedArtifact.artifact?.projectId !== projectId) return null;
  return scopedArtifact.artifact;
}
