import React from 'react'
import NetworkBadge from './NetworkBadge'
import { NETWORKS } from '@/types/stellar'

export default { title: 'NetworkBadge' }

export const Local = () => <NetworkBadge network={NETWORKS.localnet} />
export const Futurenet = () => <NetworkBadge network={NETWORKS.futurenet} />
