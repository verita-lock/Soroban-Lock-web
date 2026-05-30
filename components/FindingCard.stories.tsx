import React from 'react'
import FindingCard from './FindingCard'

const mock = {
  severity: 'High',
  check_name: 'unchecked-auth',
  description: 'This function does not check caller authorization',
  remediation: 'Validate the caller before performing state changes',
  function_name: 'transfer',
  file_path: 'src/lib.rs',
  line: 42,
}

export default { title: 'FindingCard' }

export const Default = () => <FindingCard finding={mock as any} />
