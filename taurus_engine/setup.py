from setuptools import Command, setup, find_packages
import subprocess
import sys



class ResetAllTaurusDataDistutilsCommand(Command):


  description = (
    "Distutils command extension for resetting Taurus Engine's message "
    "queues/exchanges, model checkpoints, and repository. NOTE: execute only "
    "while all Taurus Engine and Taurus Collector services are stopped.")


  user_options = [
    ("suppress-prompt-and-obliterate", None, "Specify to skip prompt"),
  ]


  def initialize_options(self):
    self.suppress_prompt_and_obliterate = 0  # pylint: disable=C0103


  def finalize_options(self):
    assert self.suppress_prompt_and_obliterate in (0, 1), (
      "Invalid suppress_prompt_and_obliterate: "
      "expected 0 or 1, but got {}".format(self.suppress_prompt_and_obliterate))


  def run(self):
    # NOTE: we execute this via subprocess in order to enable certain setup
    # options (e.g., --help-commands) to be executed without dependency on
    # certain environment variables (e.g., `APPLICATION_CONFIG_PATH`).
    cmd = [
      sys.executable,
      "-m",
      "taurus_engine.reset_all_taurus_engine_data"
    ]

    if self.suppress_prompt_and_obliterate:
      cmd.append("--suppress-prompt-and-obliterate")

    subprocess.check_call(cmd)



requirements = [str.strip(line)
                for line in open("requirements.txt").readlines()]


name = "taurus_engine"


setup(
  name = name,
  version = "0.4.0",
  description = "Taurus Server",
  packages = find_packages(),
  install_requires = requirements,
  cmdclass = {"reset_all_data": ResetAllTaurusDataDistutilsCommand},
  entry_points = {
    "console_scripts": [
      ("taurus-check-model-consistency = "
       "%s.check_model_consistency:main") % name,
      ("taurus-create-db = "
       "%s.repository:resetDatabaseConsoleScriptEntryPoint") % name,
      ("taurus-set-dynamodb = "
       "%s.runtime.dynamodb.set_dynamodb_credentials:main") % name,
      "taurus-set-api-key = %s.set_api_key:main" % name,
      "taurus-set-rabbitmq = %s.set_rabbitmq_login:main" % name,
      "taurus-set-sql-login = %s.repository.set_sql_login:main" % name
    ]
  }
)
