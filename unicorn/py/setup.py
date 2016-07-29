from pkg_resources import resource_filename
from setuptools import setup, find_packages
from setuptools.command.test import test as TestCommand
import os
import sys



installRequires = []
dependencyLinks = []


requirements = os.path.join(os.path.dirname(__file__), "requirements.txt")
with open(requirements, "r") as reqfile:
  for line in reqfile:
    line = line.strip()
    (link, _, package) = line.rpartition("#egg=")
    if link:
      # e.g., "-e https://github.com/vitaly-krugl/haigha/tarball/master#egg=haigha-0.7.4rc100"
      if line.startswith("-e"):
        line = line[2:].strip()

      dependencyLinks.append(line)

      (packageName, _, packageVersion) = package.partition("-")

      package = packageName + "==" + packageVersion

    installRequires.append(package)



class PyTest(TestCommand):
  user_options = [("pytest-args=", "a", "Arguments to pass to py.test")]


  def initialize_options(self):
    TestCommand.initialize_options(self)
    self.pytest_args = [] # pylint: disable=W0201


  def finalize_options(self):
    TestCommand.finalize_options(self)
    self.test_args = []
    self.test_suite = True

  def run_tests(self):
    #import here, cause outside the eggs aren't loaded
    import pytest
    testsLocation = resource_filename("unicorn_backend", "tests")
    cwd = os.getcwd()
    try:
      os.chdir(testsLocation)
      errno = pytest.main(self.pytest_args)
    finally:
      os.chdir(cwd)
    sys.exit(errno)

os.chdir(os.path.dirname(__file__))
setup(
  name = "unicorn_backend",
  description = "Unicorn backend",
  packages = find_packages(),
  include_package_data=True,
  install_requires = installRequires,
  dependency_links = dependencyLinks,
  tests_require=["mock==1.0.1"],
  cmdclass = {"test": PyTest},
)
