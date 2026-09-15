export enum Role {
  read_project = 'read_project',
  write_project = 'write_project',
  create_project = 'create_project',
  delete_project = 'delete_project',
  manage_project = 'manage_project',

  read_project_version = 'read_project_version',
  write_project_version = 'write_project_version',
  create_project_version = 'create_project_version',
  delete_project_version = 'delete_project_version',
  manage_project_version = 'manage_project_version',
  activate_project_version = 'activate_project_version',

  render_project = 'render_project',

  read_parameter = 'read_parameter',
  write_parameter = 'write_parameter',
  create_parameter = 'create_parameter',
  delete_parameter = 'delete_parameter',

  read_layer = 'read_layer',
  write_layer = 'write_layer',
  create_layer = 'create_layer',
  delete_layer = 'delete_layer',

  all = '*',
}
