export type TeamMember = {
  photo: string
  fullname: string
  role: string
  linkedin: string
  email?: string
}

export const TEAM: TeamMember[] = [
  {
    photo: '/team/vakhtanh.jpg',
    fullname: 'Vakhtanh Chikhladze',
    role: 'Founder, PhD Candidate',
    linkedin: 'https://www.linkedin.com/in/vakhtanh-chikhladze-333410219/',
    email: 'info@grindurus.xyz',
  },
]
