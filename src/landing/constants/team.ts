export type TeamMember = {
  photo: string
  fullname: string
  role: string
  linkedin: string
}

export const TEAM: TeamMember[] = [
  {
    photo: '/team/vakhtanh.jpg',
    fullname: 'Vakhtanh Chikhladze',
    role: 'Founder, PhD Candidate',
    linkedin: 'https://www.linkedin.com/in/vakhtanh-chikhladze-333410219/'
  },
  {
    photo: '/team/vsevolod.jpg',
    fullname: 'Vsevolod Zhuravlov',
    role: 'Fullstack Dev, ex. LTV Protocol',
    linkedin: 'https://www.linkedin.com/in/zhuravlof/'
  },
  {
    photo: '/team/ivan.jpeg',
    fullname: 'Ivan Synenko',
    role: 'Backend Dev, EPAM Systems',
    linkedin: 'https://www.linkedin.com/in/ivan-synenko-45227a294/'
  }
]
