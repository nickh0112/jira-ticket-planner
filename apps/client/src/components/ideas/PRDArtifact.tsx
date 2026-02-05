import type { IdeaPRD } from '@jira-planner/shared';

interface PRDArtifactProps {
  prd: IdeaPRD;
}

export function PRDArtifact({ prd }: PRDArtifactProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="font-pixel text-pixel-lg text-gold">{prd.title}</h1>
        <p className="text-xs text-beige/50 mt-1">
          Last updated: {new Date(prd.updatedAt).toLocaleString()}
        </p>
      </div>

      {/* Problem Statement */}
      <section>
        <h2 className="font-pixel text-sm text-gold mb-2">Problem Statement</h2>
        <p className="text-beige/90 leading-relaxed">{prd.problemStatement}</p>
      </section>

      {/* Goals */}
      <section>
        <h2 className="font-pixel text-sm text-gold mb-2">Goals</h2>
        <ul className="space-y-2">
          {prd.goals.map((goal, index) => (
            <li key={index} className="flex gap-2 text-beige/90">
              <span className="text-gold">•</span>
              <span>{goal}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* User Stories */}
      <section>
        <h2 className="font-pixel text-sm text-gold mb-2">User Stories</h2>
        <ul className="space-y-2">
          {prd.userStories.map((story, index) => (
            <li key={index} className="flex gap-2 text-beige/90">
              <span className="text-gold font-mono text-sm">{index + 1}.</span>
              <span>{story}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Functional Requirements */}
      <section>
        <h2 className="font-pixel text-sm text-gold mb-2">Functional Requirements</h2>
        <ul className="space-y-2">
          {prd.functionalRequirements.map((req, index) => (
            <li key={index} className="flex gap-2 text-beige/90">
              <span className="text-beige/40">☐</span>
              <span>{req}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Non-Functional Requirements */}
      <section>
        <h2 className="font-pixel text-sm text-gold mb-2">Non-Functional Requirements</h2>
        <p className="text-beige/90 leading-relaxed whitespace-pre-wrap">
          {prd.nonFunctionalRequirements}
        </p>
      </section>

      {/* Success Metrics */}
      <section>
        <h2 className="font-pixel text-sm text-gold mb-2">Success Metrics</h2>
        <p className="text-beige/90 leading-relaxed whitespace-pre-wrap">
          {prd.successMetrics}
        </p>
      </section>

      {/* Scope */}
      <section>
        <h2 className="font-pixel text-sm text-gold mb-2">Scope</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm text-green-400 mb-2">In Scope</h3>
            <ul className="space-y-1">
              {prd.scopeBoundaries.inScope.map((item, index) => (
                <li key={index} className="flex gap-2 text-beige/90 text-sm">
                  <span className="text-green-400">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm text-red-400 mb-2">Out of Scope</h3>
            <ul className="space-y-1">
              {prd.scopeBoundaries.outOfScope.map((item, index) => (
                <li key={index} className="flex gap-2 text-beige/90 text-sm">
                  <span className="text-red-400">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Technical Considerations */}
      {prd.technicalConsiderations && (
        <section>
          <h2 className="font-pixel text-sm text-gold mb-2">Technical Considerations</h2>
          <p className="text-beige/90 leading-relaxed whitespace-pre-wrap">
            {prd.technicalConsiderations}
          </p>
        </section>
      )}

      {/* Edit hint */}
      <div className="pt-4 border-t border-stone-600">
        <p className="text-xs text-beige/50 italic">
          💡 To edit this Blueprint, ask me in the chat. For example:
          "Add a user story about admin users" or "Change the success metric to 200ms"
        </p>
      </div>
    </div>
  );
}
