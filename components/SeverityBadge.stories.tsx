import React from 'react'
import SeverityBadge from './SeverityBadge'

export default { title: 'SeverityBadge' }

export const Critical = () => <SeverityBadge severity="Critical" />
export const High = () => <SeverityBadge severity="High" />
export const Medium = () => <SeverityBadge severity="Medium" />
export const Low = () => <SeverityBadge severity="Low" />
export const Info = () => <SeverityBadge severity="Info" />
