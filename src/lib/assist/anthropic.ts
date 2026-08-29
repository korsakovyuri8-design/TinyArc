import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type {
  Assistant,
  BriefInput,
  BriefParse,
  CompletenessCheck,
  CompletenessInput,
  ConflictInput,
  ConflictSummary,
  NudgeDraft,
  NudgeInput,
  PortfolioInput,
  PortfolioProposal,
  QueueInput,
  QueuePlan,
  RequestDraft,
  RequestDraftInput,
  SpecDraft,
  SpecInput,
} from './types'

const MODEL = 'claude-opus-5'

/**
 * Общая рамка для обоих помощников.
 *
 * Здесь же проведена граница ответственности: модель готовит текст для
 * человека и не решает. Это не вежливая формулировка — от неё зависит, чем
 * окажется результат: черновиком, который бюро правит, или решением, которое
 * бюро подписывает не читая.
 */
const SYSTEM = [
  'You help an architectural practice prepare text for its internal work.',
  'Buildings up to five storeys in Montenegro, Serbia and Greece.',
  '',
  'Boundaries that are never crossed:',
  '— you do not design: you assign no sections, loads, diameters or grades;',
  '— you do not accept work and do not rate people;',
  '— the result is a draft a person edits, not a finished document.',
  '',
  'Write in English, short and to the point, with no preamble and no praise.',
  'If the data is not enough, say so — do not invent facts about the building.',
].join('\n')

const SpecSchema = z.object({
  spec: z
    .string()
    .describe('The task brief: what to do, within what bounds, what to hand on.'),
  checklist: z
    .array(z.string())
    .describe('What has to come out of it. Checkable items, not wishes.'),
})

const BriefSchema = z.object({
  fields: z
    .object({
      typology: z.enum(['villa', 'townhouse', 'multi_family', 'mixed_use']).optional(),
      storeys: z.number().int().optional(),
      areaSqm: z.number().int().optional(),
      jurisdiction: z.enum(['ME', 'RS', 'GR']).optional(),
      terrain: z.enum(['flat', 'slope', 'flood_prone']).optional(),
      gridConnection: z.enum(['grid', 'off_grid']).optional(),
      materialSystem: z.enum(['concrete', 'masonry', 'timber', 'steel', 'hybrid']).optional(),
      targetStage: z.enum(['concept', 'permit', 'tender', 'construction']).optional(),
    })
    .describe('Only what the text states outright. Do not infer and do not fill in.'),
  missing: z.array(z.string()).describe('Fields the text does not contain. Short.'),
  notes: z.string().describe('What else the client said about the site and the task.'),
})

const PortfolioSchema = z.object({
  rating: z.number().min(0).max(10).describe('A suggested portfolio rating, 0–10.'),
  reasoning: z.string().describe('What it rests on. Checkable against the profile.'),
  gaps: z.array(z.string()).describe('What the portfolio lacks for a firmer judgement.'),
})

const CompletenessSchema = z.object({
  missing: z.array(z.string()).describe('What is missing against the brief. Empty means no remarks.'),
  worthChecking: z.array(z.string()).describe('What to look at yourself before accepting.'),
})

const RequestSchema = z.object({
  title: z.string().describe('A short title for the request, up to seventy characters.'),
  body: z.string().describe('The request written so the recipient understands it without the author.'),
})

const NudgeSchema = z.object({
  body: z.string().describe('A comment for the ticket. No reproach and no generalities.'),
  ask: z.string().describe('One question the person doing the work must answer.'),
})

const QueueSchema = z.object({
  first: z.string().describe('Where to start. One line: action, task, project.'),
  steps: z.array(z.string()).describe('Steps for today, in order. Each one an action.'),
  notes: z.string().describe('What here can wait, even though it looks urgent.'),
})

const ConflictSchema = z.object({
  positions: z
    .array(z.string())
    .describe('The positions, one line per side. Without saying who is right.'),
  question: z.string().describe('One question the arbiter has to answer.'),
})

export class AnthropicAssistant implements Assistant {
  readonly mode = 'anthropic'
  private readonly client: Anthropic

  constructor() {
    // Ключ resolve'ится SDK из окружения; проверка наличия — в preflight.
    this.client = new Anthropic()
  }

  async draftSpec(input: SpecInput): Promise<SpecDraft> {
    const facts = [
      `Project: ${input.projectTitle}`,
      `Building: ${input.typology}, ${input.storeys} storeys, ${input.areaSqm} m², ${input.jurisdiction}`,
      `Site: ${input.terrain}; utilities: ${input.gridConnection}; material: ${input.materialSystem}`,
      `Stage: ${input.stage}`,
      `Discipline: ${input.discipline}`,
      input.specializations.length > 0
        ? `Specialisation for the role: ${input.specializations.join(', ')}`
        : null,
      `Task: ${input.ticketTitle}`,
      input.direction
        ? `Direction chosen by the client: ${input.direction.title} — ${input.direction.summary}. A reference point, not a requirement.`
        : null,
      input.inboundArtifacts.length > 0
        ? `Input material from adjacent disciplines: ${input.inboundArtifacts.join(', ')}`
        : 'There is no input material from adjacent disciplines.',
    ]
      .filter(Boolean)
      .join('\n')

    return this.ask<SpecDraft>(
      [
        'Write a draft brief for one atomic task.',
        'The person doing the work sees only their own task: what is not written, they will not learn.',
        '',
        facts,
      ].join('\n'),
      SpecSchema,
      4000,
    )
  }

  /** Общая обёртка: одна форма запроса на все помощники. */
  private async ask<T>(prompt: string, schema: Parameters<typeof zodOutputFormat>[0], maxTokens = 3000): Promise<T> {
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(schema) },
    })

    const parsed = response.parsed_output
    if (!parsed) throw new Error('The model returned an answer that did not parse into the schema.')

    return parsed as T
  }

  async parseBrief(input: BriefInput): Promise<BriefParse> {
    return this.ask<BriefParse>(
      [
        'Parse the project description into brief fields.',
        'Fill in only what is stated outright. Do not infer from general reasoning:',
        'an empty field the client will fill in themselves, a guessed one they will not notice.',
        '',
        input.text,
      ].join('\n'),
      BriefSchema,
    )
  }

  async proposePortfolioRating(input: PortfolioInput): Promise<PortfolioProposal> {
    return this.ask<PortfolioProposal>(
      [
        'Suggest a portfolio rating from zero to ten for reviewing a specialist application.',
        'It is a suggestion: a person sets the rating, and they must see what it rests on.',
        'The threshold for the pool is eight, so an error either way is expensive.',
        '',
        `Name: ${input.displayName}`,
        `Link: ${input.portfolioUrl}`,
        `Disciplines: ${input.disciplines.join(', ') || '—'}`,
        `Specialisation: ${input.specializations.join(', ') || '—'}`,
        `Jurisdictions: ${input.jurisdictions.join(', ') || '—'}`,
        `Maximum storeys: ${input.maxStoreys}`,
        '',
        'Works in the profile:',
        input.works.length > 0
          ? input.works
              .map(
                (w) =>
                  `— ${w.title} (${w.kind})${w.areaSqm ? `, ${w.areaSqm} m²` : ''}: ${w.roleDescription || 'role not described'}`,
              )
              .join('\n')
          : '(empty)',
      ].join('\n'),
      PortfolioSchema,
    )
  }

  async checkCompleteness(input: CompletenessInput): Promise<CompletenessCheck> {
    return this.ask<CompletenessCheck>(
      [
        'Check the attached files against the brief before acceptance.',
        'You do not accept the work: a person presses the button. Your job is to name what',
        'the brief calls for and the file list does not show.',
        'File contents cannot be judged by their names — say so plainly.',
        '',
        `Task: ${input.ticketTitle} (${input.discipline}, stage ${input.stage})`,
        '',
        'Brief:',
        input.spec || '(empty)',
        '',
        'Attached:',
        input.artifacts.length > 0
          ? input.artifacts.map((a) => `— ${a.name} (${a.kind})`).join('\n')
          : '(nothing)',
      ].join('\n'),
      CompletenessSchema,
      2000,
    )
  }

  async draftRequest(input: RequestDraftInput): Promise<RequestDraft> {
    return this.ask<RequestDraft>(
      [
        'Turn the specialist’s note into a request to an adjacent discipline.',
        'The recipient sees neither the author’s task nor their model: the request must stand on its own.',
        'Add no facts the note does not contain — do not invent gridlines, dimensions or levels.',
        '',
        `From: ${input.fromDiscipline}. To: ${input.toDiscipline}.`,
        `The author’s task: ${input.ticketTitle}`,
        '',
        'Note:',
        input.rough,
      ].join('\n'),
      RequestSchema,
      2000,
    )
  }

  async draftNudge(input: NudgeInput): Promise<NudgeDraft> {
    const why = {
      unclaimed: `the task has been open ${Math.round(input.hours)} h and nobody has taken it on`,
      overdue: `the task deadline passed ${Math.round(input.hours)} h ago`,
      due_soon: `${Math.round(input.hours)} h left before the task deadline`,
    }[input.kind]

    return this.ask<NudgeDraft>(
      [
        'Write a draft bureau comment for a ticket where work has stalled.',
        'The aim is to move the work, not to assign blame: no reproach and no judgement of the person.',
        'Their reason may be a good one, and you do not know it — do not assume it.',
        'End with one question they are obliged to answer.',
        '',
        `Task: ${input.ticketTitle} (${input.discipline})`,
        `Why we are writing: ${why}`,
        '',
        'Brief:',
        input.spec || '(no brief written)',
      ].join('\n'),
      NudgeSchema,
      1500,
    )
  }

  async planQueue(input: QueueInput): Promise<QueuePlan> {
    return this.ask<QueuePlan>(
      [
        'Turn the manager’s queue of signals into a plan for today.',
        'The order of urgency is already computed and passed as is — do not reorder it without a reason,',
        'and if there is a reason, name it. Each step is an action of the bureau, not an observation.',
        'You do not write to the people doing the work and you accept nothing: a person reads the plan.',
        '',
        'Queue:',
        input.alerts.length > 0
          ? input.alerts
              .map(
                (a) =>
                  `— [${a.kind}] “${a.title}” (${a.discipline}), project “${a.projectTitle}”, ${Math.round(a.hours)} h`,
              )
              .join('\n')
          : '(empty)',
      ].join('\n'),
      QueueSchema,
      2000,
    )
  }

  async summariseConflict(input: ConflictInput): Promise<ConflictSummary> {
    const thread = input.comments
      .map((c) => `${c.author === 'bureau' ? 'Bureau' : 'Specialist'}: ${c.body}`)
      .join('\n')

    return this.ask<ConflictSummary>(
      [
        'Reduce the dispute on the task to the positions of the sides and one question for the arbiter.',
        'Do not settle the dispute and do not say who is right: a person rules.',
        '',
        `Task: ${input.ticketTitle}`,
        `Why it was raised: ${input.conflictNote}`,
        '',
        'The thread on the task:',
        thread || '(empty)',
      ].join('\n'),
      ConflictSchema,
      2000,
    )
  }
}
