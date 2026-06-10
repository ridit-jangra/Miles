/* eslint-disable prettier/prettier */
import type { Skill } from '../types'
import { DebuggingSkill } from './DebuggingSkill/skill'
import { FrontendSkill } from './FrontendSkill/skill'
import { GitCommitSkill } from './GitCommitSkill/skill'

export const skillsMap: Record<string, Skill> = {
  'frontend-design': FrontendSkill,
  'git-commit': GitCommitSkill,
  debugging: DebuggingSkill
}
